import { eq, desc } from 'drizzle-orm'
import { media } from '@wordsvelte/shared'
import { NotFoundError } from '$lib/server/core/errors'

export async function listMedia(db: any, opts: { uploadedBy?: number } = {}) {
	const query = db.select().from(media)
	const filtered = opts.uploadedBy ? query.where(eq(media.uploadedBy, opts.uploadedBy)) : query
	return filtered.orderBy(desc(media.createdAt), desc(media.id))
}

export async function getMedia(db: any, id: number) {
	const [record] = await db.select().from(media).where(eq(media.id, id)).limit(1)
	if (!record) throw new NotFoundError('Media')
	return record
}

export async function createMedia(
	db: any,
	data: { r2Key: string; originalName: string; mimeType: string; size: number; uploadedBy: number },
) {
	const [record] = await db.insert(media).values({
		r2Key: data.r2Key,
		originalName: data.originalName.slice(0, 255),
		mimeType: data.mimeType,
		size: data.size,
		uploadedBy: data.uploadedBy,
	}).returning()

	return record
}

/** Removes the DB row and returns the storage key so the caller can delete the object. */
export async function deleteMedia(db: any, id: number) {
	const record = await getMedia(db, id)
	await db.delete(media).where(eq(media.id, id))
	return record.r2Key
}
