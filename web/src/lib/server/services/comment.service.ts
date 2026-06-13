import { eq, desc, sql } from 'drizzle-orm'
import { comments } from '@wordsvelte/shared'
import { ValidationError, NotFoundError } from '$lib/server/errors'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_CONTENT_LENGTH = 5000

export async function createComment(
	db: any,
	data: { postId: number; authorName: string; authorEmail: string; content: string; parentId?: number },
) {
	if (!EMAIL_RE.test(data.authorEmail))
		throw new ValidationError('Invalid email format')
	if (data.content.length > MAX_CONTENT_LENGTH)
		throw new ValidationError(`Content too long (max ${MAX_CONTENT_LENGTH} chars)`)

	const [comment] = await db.insert(comments).values({
		postId: data.postId,
		authorName: data.authorName,
		authorEmail: data.authorEmail,
		content: data.content,
		parentId: data.parentId || null,
	}).returning()

	return comment
}

export async function listCommentsByPost(db: any, postId: number) {
	return db.select().from(comments)
		.where(eq(comments.postId, postId))
		.where(eq(comments.status, 'approved'))
		.orderBy(desc(comments.createdAt))
}

export async function listComments(db: any, opts: { page?: number; limit?: number } = {}) {
	const page = opts.page || 1
	const limit = opts.limit || 50
	const offset = (page - 1) * limit

	const total = await db.select({ count: sql<number>`count(*)` }).from(comments).then((r: any) => r[0].count)
	const data = await db.select().from(comments).orderBy(desc(comments.createdAt)).limit(limit).offset(offset)

	return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getComment(db: any, id: number) {
	const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1)
	if (!comment) throw new NotFoundError('Comment')
	return comment
}

export async function updateCommentStatus(db: any, id: number, status: string) {
	if (!['approved', 'pending', 'spam', 'trash'].includes(status))
		throw new ValidationError('Invalid status')

	await db.update(comments).set({ status }).where(eq(comments.id, id))
	const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1)
	if (!comment) throw new NotFoundError('Comment')
	return comment
}

export async function deleteComment(db: any, id: number) {
	await db.delete(comments).where(eq(comments.id, id))
}
