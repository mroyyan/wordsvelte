import type { DbInstance } from '$lib/server/db'
import { ROLES, type Role } from '@wordsvelte/shared'
import { ValidationError, NotFoundError, ConflictError, AppError, ForbiddenError } from '$lib/server/core/errors'
import { hashPassword, verifyPassword, verifyDummyPassword, passwordPolicyError } from '$lib/server/core/crypto'
import { EMAIL_RE } from '$lib/server/core/validators'
import { createUserRepository, type UserPatch } from '$lib/server/repositories/users.repository'

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/

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

export async function listUsers(db: DbInstance, opts: { page?: number; limit?: number } = {}) {
	const users = createUserRepository(db)
	const page = Math.max(1, opts.page || 1)
	const limit = Math.min(100, Math.max(1, opts.limit || 10))
	const offset = (page - 1) * limit

	const total = await users.count()
	const data = await users.listPublic(limit, offset)

	return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getUserByEmail(db: DbInstance, email: string) {
	return createUserRepository(db).findByEmail(normalizeEmail(email))
}

export async function createUser(
	db: DbInstance,
	data: { email: string; username: string; password: string; displayName: string; role?: string },
) {
	const users = createUserRepository(db)
	const email = normalizeEmail(data.email)
	validateEmail(email)
	const username = String(data.username ?? '').trim()
	if (!USERNAME_RE.test(username)) throw new ValidationError('Username must be 3-32 characters (letters, numbers, . _ -)')
	const pwError = passwordPolicyError(data.password)
	if (pwError) throw new ValidationError(pwError)
	const displayName = validateDisplayName(data.displayName)
	const role = data.role === undefined ? 'author' : validateRole(data.role)

	if (await users.emailTaken(email)) throw new ConflictError('Email already registered')
	if (await users.usernameTaken(username)) throw new ConflictError('Username already taken')

	const user = await users.insert({ email, username, passwordHash: await hashPassword(data.password), displayName, role })

	return { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role }
}

/** Create the very first admin. Safe against two simultaneous setup requests: only the lowest id survives. */
export async function createFirstAdmin(db: DbInstance, data: { email: string; username: string; password: string; displayName: string }) {
	const users = createUserRepository(db)
	if (await users.hasAny()) throw new AppError('Setup already completed', 403)

	const admin = await createUser(db, { ...data, role: 'admin' })

	if ((await users.minId()) !== admin.id) {
		await users.deleteById(admin.id)
		throw new AppError('Setup already completed', 403)
	}
	return admin
}

export async function validateLogin(db: DbInstance, email: string, password: string) {
	const user = await getUserByEmail(db, email)
	if (!user) {
		await verifyDummyPassword(String(password))
		throw new AppError('Invalid credentials', 401)
	}

	if (!(await verifyPassword(String(password), user.passwordHash))) throw new AppError('Invalid credentials', 401)

	return { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role }
}

export async function updateUser(
	db: DbInstance,
	actor: { userId: number },
	id: number,
	body: { displayName?: unknown; email?: unknown; role?: unknown },
) {
	if (!Number.isInteger(id)) throw new ValidationError('Invalid user id')
	if (id === 1) throw new ForbiddenError('Cannot modify the primary admin')
	if (actor.userId === id) throw new ForbiddenError('Cannot modify your own account')

	const users = createUserRepository(db)
	if (!(await users.findById(id))) throw new NotFoundError('User')

	const patch: UserPatch = {}
	if (body.displayName !== undefined) patch.displayName = validateDisplayName(body.displayName)
	if (body.role !== undefined) patch.role = validateRole(body.role)
	if (body.email !== undefined) {
		const email = normalizeEmail(body.email)
		validateEmail(email)
		if (await users.emailTaken(email, id)) throw new ConflictError('Email already registered')
		patch.email = email
	}

	await users.update(id, patch)
	return users.findPublicById(id)
}

/** True until the first administrator exists (the app then sends visitors to /admin/setup). */
export async function needsSetup(db: DbInstance): Promise<boolean> {
	return !(await createUserRepository(db).hasAny())
}
