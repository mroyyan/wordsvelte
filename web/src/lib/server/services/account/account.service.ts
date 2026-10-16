import { and, eq, ne, sql } from 'drizzle-orm'
import { users } from '@wordsvelte/shared'
import { AppError, ConflictError, NotFoundError, ValidationError } from '$lib/server/core/errors'
import { hashPassword, passwordPolicyError, verifyPassword } from '$lib/server/core/crypto'
import { EMAIL_RE } from '$lib/server/core/validators'
import { normalizeEmail } from '$lib/server/services/account/user.service'

const getRow = async (db: any, userId: number) => {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!u) throw new NotFoundError('Account')
  return u
}

const view = (u: any) => ({ id: u.id, email: u.email, username: u.username, displayName: u.displayName, role: u.role, createdAt: u.createdAt })

export async function getProfile(db: any, userId: number) {
  return view(await getRow(db, userId))
}

/** Re-checking the password before a sensitive change stops a stolen session from locking the owner out. */
async function requirePassword(user: any, password: unknown) {
  if (typeof password !== 'string' || !password || !(await verifyPassword(password, user.passwordHash))) {
    throw new AppError('Current password is incorrect', 403)
  }
}

export async function updateProfile(db: any, userId: number, body: { displayName?: unknown; email?: unknown; currentPassword?: unknown }) {
  const u = await getRow(db, userId)
  const patch: Record<string, unknown> = {}

  if (body.displayName !== undefined) {
    const name = String(body.displayName ?? '').trim()
    if (!name) throw new ValidationError('Display name is required')
    if (name.length > 100) throw new ValidationError('Display name too long (max 100 chars)')
    patch.displayName = name
  }

  if (body.email !== undefined) {
    const email = normalizeEmail(body.email)
    if (!EMAIL_RE.test(email) || email.length > 254) throw new ValidationError('Invalid email format')
    if (email !== u.email) {
      await requirePassword(u, body.currentPassword)
      const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, userId))).limit(1)
      if (taken) throw new ConflictError('Email already registered')
      patch.email = email
    }
  }

  if (Object.keys(patch).length) await db.update(users).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(users.id, userId))
  return getProfile(db, userId)
}

/**
 * Changes the password and ends every other session (sessionVersion + 1). Returns the new version so the caller can
 * issue a fresh token for the session that made the change.
 */
export async function changePassword(db: any, userId: number, currentPassword: unknown, newPassword: unknown): Promise<{ sessionVersion: number }> {
  const u = await getRow(db, userId)
  await requirePassword(u, currentPassword)
  const problem = passwordPolicyError(newPassword)
  if (problem) throw new ValidationError(problem)
  if (newPassword === currentPassword) throw new ValidationError('The new password must be different from the current one')

  await db.update(users).set({
    passwordHash: await hashPassword(newPassword as string),
    sessionVersion: sql`${users.sessionVersion} + 1`,
    updatedAt: new Date().toISOString(),
  }).where(eq(users.id, userId))
  return { sessionVersion: (await getRow(db, userId)).sessionVersion }
}

/** For actions that must be confirmed with the password (turning 2FA off, new recovery codes). */
export async function assertPassword(db: any, userId: number, password: unknown) {
  await requirePassword(await getRow(db, userId), password)
}
