import type { DbInstance } from '$lib/server/db'
import { createMediaRepository } from '$lib/server/repositories/media.repository'
import { NotFoundError } from '$lib/server/core/errors'

export async function listMedia(db: DbInstance, opts: { uploadedBy?: number } = {}) {
	return createMediaRepository(db).list(opts)
}

export async function getMedia(db: DbInstance, id: number) {
	const record = await createMediaRepository(db).findById(id)
	if (!record) throw new NotFoundError('Media')
	return record
}

export async function createMedia(
	db: DbInstance,
	data: { r2Key: string; originalName: string; mimeType: string; size: number; uploadedBy: number },
) {
	return createMediaRepository(db).insert({
		r2Key: data.r2Key,
		originalName: data.originalName.slice(0, 255),
		mimeType: data.mimeType,
		size: data.size,
		uploadedBy: data.uploadedBy,
	})
}

/** Removes the DB row and returns the storage key so the caller can delete the object. */
export async function deleteMedia(db: DbInstance, id: number) {
	const record = await getMedia(db, id)
	await createMediaRepository(db).delete(id)
	return record.r2Key
}
