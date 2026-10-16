import type { DbInstance } from '$lib/server/db'
import { ValidationError } from '$lib/server/core/errors'
import { hashPassword, passwordPolicyError } from '$lib/server/core/crypto'
import { normalizeEmail } from '$lib/server/services/account/user.service'
import type { Mailer } from '$lib/server/mail/mailer'
import { createUserRepository } from '$lib/server/repositories/users.repository'
import { createPasswordResetRepository } from '$lib/server/repositories/password-resets.repository'

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

const toHex = (bytes: Uint8Array) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')

export async function hashToken(token: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
}

function newToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)))
}

/**
 * Create a reset link for the account and mail it. Always resolves the same way whether or not the email
 * exists, so the endpoint cannot be used to discover which addresses have accounts.
 */
export async function requestPasswordReset(db: DbInstance, rawEmail: unknown, opts: { origin: string; mailer: Mailer; now?: Date }) {
  const email = normalizeEmail(rawEmail)
  if (!email) return
  const user = await createUserRepository(db).findByEmail(email)
  if (!user) return

  const now = opts.now ?? new Date()
  const token = newToken()
  await createPasswordResetRepository(db).replaceForUser(
    user.id, await hashToken(token), new Date(now.getTime() + RESET_TOKEN_TTL_MS).toISOString(), now.toISOString(),
  )

  const link = `${opts.origin}/admin/reset-password?token=${token}`
  try {
    await opts.mailer.send({
      to: user.email,
      subject: 'Reset your password',
      text: `Hi ${user.displayName},\n\nUse the link below to choose a new password. It is valid for 1 hour and can be used once.\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    })
  } catch (e) {
    // Delivery problems must not reveal that the account exists; they are logged for the operator instead.
    console.error('Failed to send password reset email:', e)
  }
}

/** Check a token without consuming it (lets the page tell people early that a link is dead). */
export async function isResetTokenValid(db: DbInstance, token: unknown, now = new Date()): Promise<boolean> {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false
  return !!(await createPasswordResetRepository(db).findValid(await hashToken(token), now.toISOString()))
}

export async function resetPassword(db: DbInstance, token: unknown, newPassword: unknown, now = new Date()) {
  const policy = passwordPolicyError(newPassword)
  if (policy) throw new ValidationError(policy)
  if (!(await isResetTokenValid(db, token, now))) throw new ValidationError('This reset link is invalid or has expired')

  const resets = createPasswordResetRepository(db)
  const row = await resets.findByHash(await hashToken(token as string))
  if (!row) throw new ValidationError('This reset link is invalid or has expired')
  // Setting the password also bumps sessionVersion: whoever had the old password loses access too.
  await createUserRepository(db).setPassword(row.userId, await hashPassword(newPassword as string), now.toISOString())
  // Consume every outstanding link for this user.
  await resets.deleteForUser(row.userId)
}
