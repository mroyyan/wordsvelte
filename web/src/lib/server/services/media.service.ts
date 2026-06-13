import { eq, desc } from 'drizzle-orm'
import { media } from '@wordsvelte/shared'
import { NotFoundError } from '$lib/server/errors'

export async function listMedia(db: any) {
	return db.select().from(media).orderBy(desc(media.createdAt))
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
		originalName: data.originalName,
		mimeType: data.mimeType,
		size: data.size,
		uploadedBy: data.uploadedBy,
	}).returning()

	return record
}

export async function deleteMedia(db: any, id: number) {
	const [record] = await db.select().from(media).where(eq(media.id, id)).limit(1)
	if (!record) throw new NotFoundError('Media')
	await db.delete(media).where(eq(media.id, id))
	return record.r2Key
}
