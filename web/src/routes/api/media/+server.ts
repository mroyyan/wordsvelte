import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { listMedia, createMedia } from '$lib/server/services/content/media.service'
import { ok, created, catchError } from '$lib/server/http/response'
import { AppError, ValidationError } from '$lib/server/core/errors'
import { MAX_UPLOAD_BYTES, validateImageUpload, buildMediaKey } from '$lib/server/storage/uploads'

export async function GET(event: any) {
	try {
		await requireUser(event, 'author')
		return ok(await listMedia(getDb(event)))
	} catch (e) { return catchError(e) }
}

export async function POST(event: any) {
	try {
		const user = await requireUser(event, 'author')
		const r2 = event.platform?.env?.R2
		if (!r2) throw new AppError('Media storage is not configured', 503)

		const formData = await event.request.formData()
		const file = formData.get('file')
		if (!(file instanceof File)) throw new ValidationError('No file')
		if (file.size > MAX_UPLOAD_BYTES) throw new ValidationError('File too large (max 20MB)')

		// Trust the bytes, not the client-supplied name/type.
		const bytes = new Uint8Array(await file.arrayBuffer())
		const { mimeType, ext } = validateImageUpload(bytes)
		const r2Key = buildMediaKey(ext)
		await r2.put(r2Key, bytes, { httpMetadata: { contentType: mimeType } })

		try {
			const record = await createMedia(getDb(event), {
				r2Key, originalName: file.name || `upload.${ext}`, mimeType, size: bytes.byteLength, uploadedBy: user.userId,
			})
			return created(record)
		} catch (e) {
			await r2.delete(r2Key).catch(() => {})
			throw e
		}
	} catch (e) { return catchError(e) }
}
