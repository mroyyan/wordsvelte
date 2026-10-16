import { eq, desc, sql, and, ne } from 'drizzle-orm'
import { users, ROLES, type Role } from '@wordsvelte/shared'
import { ValidationError, NotFoundError, ConflictError, AppError, ForbiddenError } from '$lib/server/errors'
import { hashPassword, verifyPassword, verifyDummyPassword, passwordPolicyError } from '$lib/server/crypto'
import { EMAIL_RE } from '$lib/server/validators'

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/

const publicColumns = {
	id: users.id,
	email: users.email,
	username: users.username,
	displayName: users.displayName,
	role: users.role,
	avatarUrl: users.avatarUrl,
	createdAt: users.createdAt,
}

export const normalizeEmail = (email: unknown) => String(email ?? '').trim().toLowerCase()

export function validateRole(role: unknown): Role {
	if (!ROLES.includes(role as Role)) throw new ValidationError(`Role must be one of: ${ROLES.join(', ')}`)
	return role as Role
}

function validateEmail(email: string) {
	if (!EMAIL_RE.test(email) || email.length > 254) throw new ValidationError('Invalid email format')
}

function validateDisplayName(name: unknown): string {
	const v = String(name ?? '').trim()
	if (!v) throw new ValidationError('Display name is required')
	if (v.length > 100) throw new ValidationError('Display name too long (max 100 chars)')
	return v
}

export async function listUsers(db: any, opts: { page?: number; limit?: number } = {}) {
	const page = Math.max(1, opts.page || 1)
	const limit = Math.min(100, Math.max(1, opts.limit || 10))
	const offset = (page - 1) * limit

	const total = await db.select({ count: sql<number>`count(*)` }).from(users).then((r: any) => r[0].count)
	const data = await db.select(publicColumns).from(users).orderBy(desc(users.createdAt), desc(users.id)).limit(limit).offset(offset)

	return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getUserByEmail(db: any, email: string) {
	const [user] = await db.select().from(users).where(eq(users.email, normalizeEmail(email))).limit(1)
	return user || null
}

export async function createUser(
	db: any,
	data: { email: string; username: string; password: string; displayName: string; role?: string },
) {
	const email = normalizeEmail(data.email)
	validateEmail(email)
	const username = String(data.username ?? '').trim()
	if (!USERNAME_RE.test(username)) throw new ValidationError('Username must be 3-32 characters (letters, numbers, . _ -)')
	const pwError = passwordPolicyError(data.password)
	if (pwError) throw new ValidationError(pwError)
	const displayName = validateDisplayName(data.displayName)
	const role = data.role === undefined ? 'author' : validateRole(data.role)

	const [emailTaken] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
	if (emailTaken) throw new ConflictError('Email already registered')
	const [nameTaken] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
	if (nameTaken) throw new ConflictError('Username already taken')

	const passwordHash = await hashPassword(data.password)
	const [user] = await db.insert(users).values({ email, username, passwordHash, displayName, role }).returning()

	return { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role }
}

/** Create the very first admin. Safe against two simultaneous setup requests: only the lowest id survives. */
export async function createFirstAdmin(db: any, data: { email: string; username: string; password: string; displayName: string }) {
	const [existing] = await db.select({ id: users.id }).from(users).limit(1)
	if (existing) throw new AppError('Setup already completed', 403)

	const admin = await createUser(db, { ...data, role: 'admin' })

	const [{ minId }] = await db.select({ minId: sql<number>`min(${users.id})` }).from(users)
	if (minId !== admin.id) {
		await db.delete(users).where(eq(users.id, admin.id))
		throw new AppError('Setup already completed', 403)
	}
	return admin
}

export async function validateLogin(db: any, email: string, password: string) {
	const user = await getUserByEmail(db, email)
	if (!user) {
		await verifyDummyPassword(String(password))
		throw new AppError('Invalid credentials', 401)
	}

	if (!(await verifyPassword(String(password), user.passwordHash))) throw new AppError('Invalid credentials', 401)

	return { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role }
}

export async function updateUser(
	db: any,
	actor: { userId: number },
	id: number,
	body: { displayName?: unknown; email?: unknown; role?: unknown },
) {
	if (!Number.isInteger(id)) throw new ValidationError('Invalid user id')
	if (id === 1) throw new ForbiddenError('Cannot modify the primary admin')
	if (actor.userId === id) throw new ForbiddenError('Cannot modify your own account')

	const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
	if (!existing) throw new NotFoundError('User')

	const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }
	if (body.displayName !== undefined) patch.displayName = validateDisplayName(body.displayName)
	if (body.role !== undefined) patch.role = validateRole(body.role)
	if (body.email !== undefined) {
		const email = normalizeEmail(body.email)
		validateEmail(email)
		const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, id))).limit(1)
		if (taken) throw new ConflictError('Email already registered')
		patch.email = email
	}

	await db.update(users).set(patch).where(eq(users.id, id))
	const [updated] = await db.select(publicColumns).from(users).where(eq(users.id, id)).limit(1)
	return updated
}
