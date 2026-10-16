import type { DbInstance } from '$lib/server/db'
import { renderSVG } from 'uqr'
import { AppError, ValidationError } from '$lib/server/core/errors'
import { timingSafeEqual } from '$lib/server/core/crypto'
import type { Mailer } from '$lib/server/mail/mailer'
import { createUserRepository, type UserRow } from '$lib/server/repositories/users.repository'
import { createTwoFactorRepository, type EmailCodePurpose } from '$lib/server/repositories/two-factor.repository'
import { openSecret, sealSecret } from '$lib/server/auth/two-factor/secret-box'
import { generateTotpSecret, otpauthUri, verifyTotp } from '$lib/server/auth/two-factor/totp'
import { RECOVERY_CODE_COUNT, generateRecoveryCode, hashCode, normalizeRecoveryCode, randomDigits } from '$lib/server/auth/two-factor/codes'

export type { EmailCodePurpose }

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
export const EMAIL_CODE_MAX_ATTEMPTS = 5
const TOTP_PURPOSE = 'totp-secret'

export type SecondFactorMethod = 'totp' | 'email' | 'recovery'

export interface TwoFactorStatus {
  totpEnabled: boolean
  /** A TOTP secret was generated but never confirmed. */
  totpPending: boolean
  email2faEnabled: boolean
  recoveryCodesRemaining: number
}

async function loadUser(db: DbInstance, userId: number): Promise<UserRow> {
  const user = await createUserRepository(db).findById(userId)
  if (!user) throw new AppError('Account not found', 404)
  return user
}

export async function getTwoFactorStatus(db: DbInstance, userId: number): Promise<TwoFactorStatus> {
  const u = await loadUser(db, userId)
  const remaining = await createTwoFactorRepository(db).countRecoveryCodes(userId, { unusedOnly: true })
  return { totpEnabled: u.totpEnabled, totpPending: !u.totpEnabled && !!u.totpSecret, email2faEnabled: u.email2faEnabled, recoveryCodesRemaining: remaining }
}

export const isTwoFactorEnabled = (u: { totpEnabled: boolean; email2faEnabled: boolean }) => u.totpEnabled || u.email2faEnabled

// ---------- Recovery codes ----------

export async function regenerateRecoveryCodes(db: DbInstance, secret: Uint8Array, userId: number): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode)
  const hashes = await Promise.all(codes.map(code => hashCode(secret, 'recovery', normalizeRecoveryCode(code))))
  await createTwoFactorRepository(db).replaceRecoveryCodes(userId, hashes)
  return codes
}

async function consumeRecoveryCode(db: DbInstance, secret: Uint8Array, userId: number, code: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code)
  if (!normalized) return false
  const hash = await hashCode(secret, 'recovery', normalized)
  const repo = createTwoFactorRepository(db)
  const match = (await repo.unusedRecoveryCodes(userId)).find(r => timingSafeEqual(r.codeHash, hash))
  return match ? repo.markRecoveryCodeUsed(match.id) : false
}

async function ensureRecoveryCodes(db: DbInstance, secret: Uint8Array, userId: number): Promise<string[] | null> {
  return (await createTwoFactorRepository(db).countRecoveryCodes(userId)) === 0 ? regenerateRecoveryCodes(db, secret, userId) : null
}

async function dropRecoveryCodesIfNoFactor(db: DbInstance, userId: number) {
  if (!isTwoFactorEnabled(await loadUser(db, userId))) await createTwoFactorRepository(db).deleteRecoveryCodes(userId)
}

// ---------- Authenticator app (TOTP) ----------

export async function beginTotpSetup(db: DbInstance, secret: Uint8Array, userId: number, issuer: string) {
  const u = await loadUser(db, userId)
  if (u.totpEnabled) throw new ValidationError('An authenticator app is already set up. Turn it off first to set up a new one.')
  const seed = generateTotpSecret()
  await createUserRepository(db).startTotp(userId, await sealSecret(secret, TOTP_PURPOSE, seed))
  const uri = otpauthUri({ secret: seed, account: u.email, issuer })
  return { secret: seed, uri, qrSvg: renderSVG(uri, { border: 1 }) }
}

/** Verify a TOTP code and remember the step so the same code cannot be replayed. */
async function checkTotp(db: DbInstance, secret: Uint8Array, user: UserRow, code: string, now: number): Promise<boolean> {
  const seed = user.totpSecret ? await openSecret(secret, TOTP_PURPOSE, user.totpSecret) : null
  if (!seed) return false
  const r = await verifyTotp(seed, code, { now, lastStep: user.totpLastStep ?? undefined })
  if (!r.ok || r.step === undefined) return false
  return createUserRepository(db).claimTotpStep(user.id, r.step)
}

export async function confirmTotpSetup(db: DbInstance, secret: Uint8Array, userId: number, code: string, now = Date.now()): Promise<{ recoveryCodes: string[] | null }> {
  const u = await loadUser(db, userId)
  if (u.totpEnabled) throw new ValidationError('An authenticator app is already set up')
  if (!u.totpSecret) throw new ValidationError('Start the setup first')
  if (!(await checkTotp(db, secret, u, code, now))) throw new ValidationError('That code is not correct. Check the time on your phone and try again.')
  await createUserRepository(db).enableTotp(userId)
  return { recoveryCodes: await ensureRecoveryCodes(db, secret, userId) }
}

export async function disableTotp(db: DbInstance, userId: number) {
  await createUserRepository(db).clearTotp(userId)
  await dropRecoveryCodesIfNoFactor(db, userId)
}

// ---------- Email codes ----------

export async function sendEmailCode(db: DbInstance, secret: Uint8Array, userId: number, purpose: EmailCodePurpose, mailer: Mailer, siteName: string, now = new Date()) {
  const u = await loadUser(db, userId)
  const code = randomDigits(6)
  await createTwoFactorRepository(db).replaceEmailCode(
    userId, purpose, await hashCode(secret, `email:${purpose}:${userId}`, code),
    new Date(now.getTime() + EMAIL_CODE_TTL_MS).toISOString(), now.toISOString(),
  )
  const minutes = EMAIL_CODE_TTL_MS / 60000
  await mailer.send({
    to: u.email,
    subject: `${code} is your ${siteName} verification code`,
    text: `Hi ${u.displayName},\n\nYour verification code is ${code}\n\nIt is valid for ${minutes} minutes and can be used once. If you did not request it, someone may know your password: please change it.`,
  })
}

async function checkEmailCode(db: DbInstance, secret: Uint8Array, userId: number, purpose: EmailCodePurpose, code: string, now: Date): Promise<boolean> {
  const repo = createTwoFactorRepository(db)
  const row = await repo.latestEmailCode(userId, purpose)
  if (!row) return false
  if (row.expiresAt <= now.toISOString() || row.attempts >= EMAIL_CODE_MAX_ATTEMPTS) return false
  const good = timingSafeEqual(row.codeHash, await hashCode(secret, `email:${purpose}:${userId}`, String(code ?? '').replace(/\s/g, '')))
  if (!good) {
    await repo.recordFailedEmailCodeAttempt(row.id)
    return false
  }
  return repo.consumeEmailCode(row.id)
}

export async function confirmEmail2fa(db: DbInstance, secret: Uint8Array, userId: number, code: string, now = new Date()): Promise<{ recoveryCodes: string[] | null }> {
  if (!(await checkEmailCode(db, secret, userId, 'enable', code, now))) throw new ValidationError('That code is not correct or has expired')
  await createUserRepository(db).enableEmail2fa(userId)
  return { recoveryCodes: await ensureRecoveryCodes(db, secret, userId) }
}

export async function disableEmail2fa(db: DbInstance, userId: number) {
  await createUserRepository(db).disableEmail2fa(userId)
  await createTwoFactorRepository(db).deleteEmailCodes(userId)
  await dropRecoveryCodesIfNoFactor(db, userId)
}

// ---------- Sign-in ----------

/** Which second factors this account can use right now (what the sign-in screen should offer). */
export const availableMethods = (u: { totpEnabled: boolean; email2faEnabled: boolean }): SecondFactorMethod[] => {
  const m: SecondFactorMethod[] = []
  if (u.totpEnabled) m.push('totp')
  if (u.email2faEnabled) m.push('email')
  if (m.length) m.push('recovery')
  return m
}

export async function verifySecondFactor(db: DbInstance, secret: Uint8Array, userId: number, method: unknown, code: unknown, now = new Date()): Promise<boolean> {
  if (typeof code !== 'string' || !code.trim() || code.length > 64) return false
  const u = await loadUser(db, userId)
  if (!availableMethods(u).includes(method as SecondFactorMethod)) return false
  if (method === 'totp') return checkTotp(db, secret, u, code, now.getTime())
  if (method === 'email') return checkEmailCode(db, secret, userId, 'login', code, now)
  return consumeRecoveryCode(db, secret, userId, code)
}

/** What the login route needs to decide between "signed in" and "second factor required". */
export async function getAuthState(db: DbInstance, userId: number) {
  const u = await loadUser(db, userId)
  return { sessionVersion: u.sessionVersion, totpEnabled: u.totpEnabled, email2faEnabled: u.email2faEnabled }
}

/** Mail the code that proves an address can receive them before email 2FA is switched on (so a typo cannot lock anyone out). */
export async function sendEnrolmentCode(db: DbInstance, secret: Uint8Array, userId: number, mail: () => Promise<{ mailer: Mailer; siteName: string }>) {
  try {
    const { mailer, siteName } = await mail()
    await sendEmailCode(db, secret, userId, 'enable', mailer, siteName)
  } catch (e) {
    console.error('Failed to send the verification email:', e)
    throw new AppError('Could not send the email. Check Settings > Email first.', 502)
  }
}
