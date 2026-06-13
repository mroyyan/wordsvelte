import { eq, desc, sql } from 'drizzle-orm'
import { users } from '@wordsvelte/shared'
import { ValidationError, NotFoundError, ConflictError, AppError } from '$lib/server/errors'
import { hashPassword, verifyPassword } from '$lib/server/crypto'

export async function listUsers(db: any, opts: { page?: number; limit?: number } = {}) {
	const page = opts.page || 1
	const limit = opts.limit || 10
	const offset = (page - 1) * limit

	const total = await db.select({ count: sql<number>`count(*)` }).from(users).then((r: any) => r[0].count)
	const data = await db.select({
		id: users.id,
		email: users.email,
		username: users.username,
		displayName: users.displayName,
		role: users.role,
		avatarUrl: users.avatarUrl,
		createdAt: users.createdAt,
	}).from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset)

	return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getUserByEmail(db: any, email: string) {
	const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
	return user || null
}

export async function createUser(
	db: any,
	data: { email: string; username: string; password: string; displayName: string; role?: string },
) {
	const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1)
	if (existing.length) throw new ConflictError('Email already registered')

	const passwordHash = await hashPassword(data.password)
	const [user] = await db.insert(users).values({
		email: data.email,
		username: data.username,
		passwordHash,
		displayName: data.displayName,
		role: data.role || 'author',
	}).returning()

	return {
		id: user.id,
		email: user.email,
		username: user.username,
		displayName: user.displayName,
		role: user.role,
	}
}

export async function validateLogin(db: any, email: string, password: string) {
	const user = await getUserByEmail(db, email)
	if (!user) throw new AppError('Invalid credentials', 401)

	const valid = await verifyPassword(password, user.passwordHash)
	if (!valid) throw new AppError('Invalid credentials', 401)

	return {
		id: user.id,
		email: user.email,
		username: user.username,
		displayName: user.displayName,
		role: user.role,
	}
}
