import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { recoveryCodes, twoFactorCodes, users } from '@wordsvelte/shared'
import { renderSVG } from 'uqr'
import { AppError, ValidationError } from '$lib/server/core/errors'
import { timingSafeEqual } from '$lib/server/core/crypto'
import type { Mailer } from '$lib/server/mail/mailer'
import { openSecret, sealSecret } from '$lib/server/auth/two-factor/secret-box'
import { generateTotpSecret, otpauthUri, verifyTotp } from '$lib/server/auth/two-factor/totp'
import { RECOVERY_CODE_COUNT, generateRecoveryCode, hashCode, normalizeRecoveryCode, randomDigits } from '$lib/server/auth/two-factor/codes'

export const EMAIL_CODE_TTL_MS = 10 * 60 * 1000
export const EMAIL_CODE_MAX_ATTEMPTS = 5
const TOTP_PURPOSE = 'totp-secret'

export type SecondFactorMethod = 'totp' | 'email' | 'recovery'
export type EmailCodePurpose = 'login' | 'enable'

export interface TwoFactorStatus {
  totpEnabled: boolean
  /** A TOTP secret was generated but never confirmed. */
  totpPending: boolean
  email2faEnabled: boolean
  recoveryCodesRemaining: number
}

const getUser = async (db: any, userId: number) => {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!u) throw new AppError('Account not found', 404)
  return u
}

const bumpSessions = sql`${users.sessionVersion} + 1`

export async function getTwoFactorStatus(db: any, userId: number): Promise<TwoFactorStatus> {
  const u = await getUser(db, userId)
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(recoveryCodes).where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)))
  return { totpEnabled: u.totpEnabled, totpPending: !u.totpEnabled && !!u.totpSecret, email2faEnabled: u.email2faEnabled, recoveryCodesRemaining: n }
}

export const isTwoFactorEnabled = (u: { totpEnabled: boolean; email2faEnabled: boolean }) => u.totpEnabled || u.email2faEnabled

// ---------- Recovery codes ----------

export async function regenerateRecoveryCodes(db: any, secret: Uint8Array, userId: number): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode)
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId))
  for (const code of codes) {
    await db.insert(recoveryCodes).values({ userId, codeHash: await hashCode(secret, 'recovery', normalizeRecoveryCode(code)) })
  }
  return codes
}

async function consumeRecoveryCode(db: any, secret: Uint8Array, userId: number, code: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code)
  if (!normalized) return false
  const hash = await hashCode(secret, 'recovery', normalized)
  const rows = await db.select().from(recoveryCodes).where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)))
  const match = rows.find((r: any) => timingSafeEqual(r.codeHash, hash))
  if (!match) return false
  // Guarded update: if two requests race with the same code only one of them wins.
  const res = await db.update(recoveryCodes).set({ usedAt: new Date().toISOString() }).where(and(eq(recoveryCodes.id, match.id), isNull(recoveryCodes.usedAt))).returning({ id: recoveryCodes.id })
  return res.length === 1
}

// ---------- Authenticator app (TOTP) ----------

export async function beginTotpSetup(db: any, secret: Uint8Array, userId: number, issuer: string) {
  const u = await getUser(db, userId)
  if (u.totpEnabled) throw new ValidationError('An authenticator app is already set up. Turn it off first to set up a new one.')
  const seed = generateTotpSecret()
  await db.update(users).set({ totpSecret: await sealSecret(secret, TOTP_PURPOSE, seed), totpLastStep: null }).where(eq(users.id, userId))
  const uri = otpauthUri({ secret: seed, account: u.email, issuer })
  return { secret: seed, uri, qrSvg: renderSVG(uri, { border: 1 }) }
}

async function readTotpSecret(secret: Uint8Array, boxed: string | null): Promise<string | null> {
  return boxed ? openSecret(secret, TOTP_PURPOSE, boxed) : null
}

/** Verify a TOTP code and remember the step so the same code cannot be replayed. */
async function checkTotp(db: any, secret: Uint8Array, user: any, code: string, now: number): Promise<boolean> {
  const seed = await readTotpSecret(secret, user.totpSecret)
  if (!seed) return false
  const r = await verifyTotp(seed, code, { now, lastStep: user.totpLastStep ?? undefined })
  if (!r.ok || r.step === undefined) return false
  const res = await db.update(users).set({ totpLastStep: r.step })
    .where(and(eq(users.id, user.id), or(isNull(users.totpLastStep), lt(users.totpLastStep, r.step)))).returning({ id: users.id })
  return res.length === 1
}

export async function confirmTotpSetup(db: any, secret: Uint8Array, userId: number, code: string, now = Date.now()): Promise<{ recoveryCodes: string[] | null }> {
  const u = await getUser(db, userId)
  if (u.totpEnabled) throw new ValidationError('An authenticator app is already set up')
  if (!u.totpSecret) throw new ValidationError('Start the setup first')
  if (!(await checkTotp(db, secret, u, code, now))) throw new ValidationError('That code is not correct. Check the time on your phone and try again.')
  await db.update(users).set({ totpEnabled: true }).where(eq(users.id, userId))
  return { recoveryCodes: await ensureRecoveryCodes(db, secret, userId) }
}

export async function disableTotp(db: any, userId: number) {
  await db.update(users).set({ totpEnabled: false, totpSecret: null, totpLastStep: null, sessionVersion: bumpSessions }).where(eq(users.id, userId))
  await dropRecoveryCodesIfNoFactor(db, userId)
}

async function ensureRecoveryCodes(db: any, secret: Uint8Array, userId: number): Promise<string[] | null> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(recoveryCodes).where(eq(recoveryCodes.userId, userId))
  return n === 0 ? regenerateRecoveryCodes(db, secret, userId) : null
}

async function dropRecoveryCodesIfNoFactor(db: any, userId: number) {
  const u = await getUser(db, userId)
  if (!isTwoFactorEnabled(u)) await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId))
}

// ---------- Email codes ----------

export async function sendEmailCode(db: any, secret: Uint8Array, userId: number, purpose: EmailCodePurpose, mailer: Mailer, siteName: string, now = new Date()) {
  const u = await getUser(db, userId)
  await db.delete(twoFactorCodes).where(and(eq(twoFactorCodes.userId, userId), eq(twoFactorCodes.purpose, purpose)))
  await db.delete(twoFactorCodes).where(lt(twoFactorCodes.expiresAt, now.toISOString()))
  const code = randomDigits(6)
  await db.insert(twoFactorCodes).values({
    userId, purpose, codeHash: await hashCode(secret, `email:${purpose}:${userId}`, code),
    expiresAt: new Date(now.getTime() + EMAIL_CODE_TTL_MS).toISOString(),
  })
  const minutes = EMAIL_CODE_TTL_MS / 60000
  await mailer.send({
    to: u.email,
    subject: `${code} is your ${siteName} verification code`,
    text: `Hi ${u.displayName},\n\nYour verification code is ${code}\n\nIt is valid for ${minutes} minutes and can be used once. If you did not request it, someone may know your password: please change it.`,
  })
}

async function checkEmailCode(db: any, secret: Uint8Array, userId: number, purpose: EmailCodePurpose, code: string, now: Date): Promise<boolean> {
  const [row] = await db.select().from(twoFactorCodes).where(and(eq(twoFactorCodes.userId, userId), eq(twoFactorCodes.purpose, purpose))).orderBy(desc(twoFactorCodes.id)).limit(1)
  if (!row) return false
  if (row.expiresAt <= now.toISOString() || row.attempts >= EMAIL_CODE_MAX_ATTEMPTS) return false
  const good = timingSafeEqual(row.codeHash, await hashCode(secret, `email:${purpose}:${userId}`, String(code ?? '').replace(/\s/g, '')))
  if (!good) {
    await db.update(twoFactorCodes).set({ attempts: sql`${twoFactorCodes.attempts} + 1` }).where(eq(twoFactorCodes.id, row.id))
    return false
  }
  // Single use, even under concurrent requests.
  const res = await db.delete(twoFactorCodes).where(eq(twoFactorCodes.id, row.id)).returning({ id: twoFactorCodes.id })
  return res.length === 1
}

export async function confirmEmail2fa(db: any, secret: Uint8Array, userId: number, code: string, now = new Date()): Promise<{ recoveryCodes: string[] | null }> {
  if (!(await checkEmailCode(db, secret, userId, 'enable', code, now))) throw new ValidationError('That code is not correct or has expired')
  await db.update(users).set({ email2faEnabled: true }).where(eq(users.id, userId))
  return { recoveryCodes: await ensureRecoveryCodes(db, secret, userId) }
}

export async function disableEmail2fa(db: any, userId: number) {
  await db.update(users).set({ email2faEnabled: false, sessionVersion: bumpSessions }).where(eq(users.id, userId))
  await db.delete(twoFactorCodes).where(eq(twoFactorCodes.userId, userId))
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

export async function verifySecondFactor(db: any, secret: Uint8Array, userId: number, method: unknown, code: unknown, now = new Date()): Promise<boolean> {
  if (typeof code !== 'string' || !code.trim() || code.length > 64) return false
  const u = await getUser(db, userId)
  if (!availableMethods(u).includes(method as SecondFactorMethod)) return false
  if (method === 'totp') return checkTotp(db, secret, u, code, now.getTime())
  if (method === 'email') return checkEmailCode(db, secret, userId, 'login', code, now)
  return consumeRecoveryCode(db, secret, userId, code)
}

/** What the login route needs to decide between "signed in" and "second factor required". */
export async function getAuthState(db: any, userId: number) {
  const u = await getUser(db, userId)
  return { sessionVersion: u.sessionVersion as number, totpEnabled: u.totpEnabled as boolean, email2faEnabled: u.email2faEnabled as boolean }
}
