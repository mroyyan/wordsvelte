import type { DbInstance } from '$lib/server/db'
import { createCommentRepository } from '$lib/server/repositories/comments.repository'
import { createPostRepository } from '$lib/server/repositories/posts.repository'
import { ValidationError, NotFoundError, ForbiddenError } from '$lib/server/core/errors'
import { EMAIL_RE } from '$lib/server/core/validators'
import { getSettings } from '$lib/server/services/site/settings.service'
import { parseStoredDate } from '$lib/shared/format-date'

const MAX_CONTENT_LENGTH = 5000
const MAX_NAME_LENGTH = 100

export const COMMENT_STATUSES = ['approved', 'pending', 'spam', 'trash'] as const

export async function createComment(
	db: DbInstance,
	data: { postId: number; authorName: string; authorEmail: string; content: string; parentId?: number },
) {
	const comments = createCommentRepository(db)
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

	const post = await createPostRepository(db).findById(postId)
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
		const parent = await comments.findById(Number(data.parentId))
		if (!parent || parent.postId !== postId) throw new ValidationError('Invalid parent comment')
		parentId = parent.id
	}

	const status = settings.comments_auto_approve === 'true' ? 'approved' : 'pending'
	const comment = await comments.insert({ postId, authorName, authorEmail, content, parentId, status })

	// Don't echo the email back to an anonymous caller.
	const { authorEmail: _email, ...publicComment } = comment
	return publicComment
}

export async function listCommentsByPost(db: DbInstance, postId: number) {
	return createCommentRepository(db).listApprovedByPost(postId)
}

export async function listComments(db: DbInstance, opts: { page?: number; limit?: number; status?: string } = {}) {
	const page = Math.max(1, opts.page || 1)
	const limit = Math.min(100, Math.max(1, opts.limit || 50))
	const offset = (page - 1) * limit

	const { rows: data, total } = await createCommentRepository(db).list({ status: opts.status, limit, offset })

	return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getComment(db: DbInstance, id: number) {
	const comment = await createCommentRepository(db).findById(id)
	if (!comment) throw new NotFoundError('Comment')
	return comment
}

export async function updateCommentStatus(db: DbInstance, id: number, status: string) {
	if (!(COMMENT_STATUSES as readonly string[]).includes(status)) throw new ValidationError('Invalid status')

	await getComment(db, id)
	await createCommentRepository(db).updateStatus(id, status)
	return getComment(db, id)
}

export async function deleteComment(db: DbInstance, id: number) {
	await getComment(db, id)
	await createCommentRepository(db).delete(id)
}
