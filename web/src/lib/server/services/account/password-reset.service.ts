import { and, eq, gt, lt, sql } from 'drizzle-orm'
import { passwordResets, users } from '@wordsvelte/shared'
import { ValidationError } from '$lib/server/core/errors'
import { hashPassword, passwordPolicyError } from '$lib/server/core/crypto'
import { normalizeEmail } from '$lib/server/services/account/user.service'
import type { Mailer } from '$lib/server/mail/mailer'

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
export async function requestPasswordReset(db: any, rawEmail: unknown, opts: { origin: string; mailer: Mailer; now?: Date }) {
  const email = normalizeEmail(rawEmail)
  if (!email) return
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) return

  const now = opts.now ?? new Date()
  // Only the newest link works, and expired ones don't pile up.
  await db.delete(passwordResets).where(eq(passwordResets.userId, user.id))
  await db.delete(passwordResets).where(lt(passwordResets.expiresAt, now.toISOString()))

  const token = newToken()
  await db.insert(passwordResets).values({
    userId: user.id,
    tokenHash: await hashToken(token),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS).toISOString(),
  })

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
export async function isResetTokenValid(db: any, token: unknown, now = new Date()): Promise<boolean> {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false
  const [row] = await db.select({ id: passwordResets.id }).from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, await hashToken(token)), gt(passwordResets.expiresAt, now.toISOString()))).limit(1)
  return !!row
}

export async function resetPassword(db: any, token: unknown, newPassword: unknown, now = new Date()) {
  const policy = passwordPolicyError(newPassword)
  if (policy) throw new ValidationError(policy)
  if (!(await isResetTokenValid(db, token, now))) throw new ValidationError('This reset link is invalid or has expired')

  const [row] = await db.select().from(passwordResets).where(eq(passwordResets.tokenHash, await hashToken(token as string))).limit(1)
  const passwordHash = await hashPassword(newPassword as string)
  // Bumping sessionVersion signs the account out everywhere: whoever had the old password loses access too.
  await db.update(users).set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now.toISOString() }).where(eq(users.id, row.userId))
  // Consume every outstanding link for this user.
  await db.delete(passwordResets).where(eq(passwordResets.userId, row.userId))
}
