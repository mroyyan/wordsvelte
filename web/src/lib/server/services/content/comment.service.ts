import { eq, desc, sql, and } from 'drizzle-orm'
import { comments, posts } from '@wordsvelte/shared'
import { ValidationError, NotFoundError, ForbiddenError } from '$lib/server/core/errors'
import { EMAIL_RE } from '$lib/server/core/validators'
import { getSettings } from '$lib/server/services/site/settings.service'
import { parseStoredDate } from '$lib/shared/format-date'

const MAX_CONTENT_LENGTH = 5000
const MAX_NAME_LENGTH = 100

export const COMMENT_STATUSES = ['approved', 'pending', 'spam', 'trash'] as const

/** Columns safe to show on the public site: never the commenter's email. */
export const publicCommentColumns = {
	id: comments.id,
	postId: comments.postId,
	authorName: comments.authorName,
	content: comments.content,
	parentId: comments.parentId,
	createdAt: comments.createdAt,
}

export async function createComment(
	db: any,
	data: { postId: number; authorName: string; authorEmail: string; content: string; parentId?: number },
) {
	const postId = Number(data.postId)
	if (!Number.isInteger(postId)) throw new ValidationError('Invalid post')
	const settings = await getSettings(db)
	const requireIdentity = settings.comments_require_name_email !== 'false'
	let authorName = String(data.authorName ?? '').trim()
	const authorEmail = String(data.authorEmail ?? '').trim()
	const content = String(data.content ?? '').trim()

	if (!authorName && !requireIdentity) authorName = 'Anonim'
	if (!authorName) throw new ValidationError('Name is required')
	if (authorName.length > MAX_NAME_LENGTH) throw new ValidationError(`Name too long (max ${MAX_NAME_LENGTH} chars)`)
	// When identity is optional the email may be left out, but one that is given must still be valid.
	if (authorEmail || requireIdentity) {
		if (!EMAIL_RE.test(authorEmail) || authorEmail.length > 254) throw new ValidationError('Invalid email format')
	}
	if (!content) throw new ValidationError('Comment is required')
	if (content.length > MAX_CONTENT_LENGTH) throw new ValidationError(`Content too long (max ${MAX_CONTENT_LENGTH} chars)`)

	const [post] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1)
	if (!post || post.status !== 'publish') throw new NotFoundError('Post')

	if (settings.comments_enabled === 'false') throw new ForbiddenError('Comments are disabled')
	const closeAfterDays = parseInt(settings.comments_close_after_days || '0', 10)
	if (closeAfterDays > 0) {
		const published = parseStoredDate(post.publishedAt || post.createdAt)?.getTime() ?? NaN
		if (Number.isFinite(published) && Date.now() - published > closeAfterDays * 86_400_000) {
			throw new ForbiddenError('Comments are closed for this post')
		}
	}

	let parentId: number | null = null
	if (data.parentId !== undefined && data.parentId !== null) {
		const [parent] = await db.select().from(comments).where(eq(comments.id, Number(data.parentId))).limit(1)
		if (!parent || parent.postId !== postId) throw new ValidationError('Invalid parent comment')
		parentId = parent.id
	}

	const status = settings.comments_auto_approve === 'true' ? 'approved' : 'pending'
	const [comment] = await db.insert(comments).values({ postId, authorName, authorEmail, content, parentId, status }).returning()

	// Don't echo the email back to an anonymous caller.
	const { authorEmail: _email, ...publicComment } = comment
	return publicComment
}

export async function listCommentsByPost(db: any, postId: number) {
	return db.select(publicCommentColumns).from(comments)
		.where(and(eq(comments.postId, postId), eq(comments.status, 'approved')))
		.orderBy(desc(comments.createdAt))
}

export async function listComments(db: any, opts: { page?: number; limit?: number; status?: string } = {}) {
	const page = Math.max(1, opts.page || 1)
	const limit = Math.min(100, Math.max(1, opts.limit || 50))
	const offset = (page - 1) * limit
	const where = opts.status ? eq(comments.status, opts.status) : undefined

	const total = await db.select({ count: sql<number>`count(*)` }).from(comments).where(where).then((r: any) => r[0].count)
	const data = await db.select().from(comments).where(where).orderBy(desc(comments.createdAt), desc(comments.id)).limit(limit).offset(offset)

	return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getComment(db: any, id: number) {
	const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1)
	if (!comment) throw new NotFoundError('Comment')
	return comment
}

export async function updateCommentStatus(db: any, id: number, status: string) {
	if (!(COMMENT_STATUSES as readonly string[]).includes(status)) throw new ValidationError('Invalid status')

	await getComment(db, id)
	await db.update(comments).set({ status }).where(eq(comments.id, id))
	return getComment(db, id)
}

export async function deleteComment(db: any, id: number) {
	await getComment(db, id)
	await db.delete(comments).where(eq(comments.id, id))
}
