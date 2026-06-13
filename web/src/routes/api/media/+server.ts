import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { listMedia, createMedia } from '$lib/server/services/media.service'
import { ok, created, catchError } from '$lib/server/response'
import { ValidationError } from '$lib/server/errors'

export async function GET(event: any) {
	try {
		await verifyAuth(event)
		const db = getDb(event)
		const data = await listMedia(db)
		return ok(data)
	} catch (e) { return catchError(e) }
}

export async function POST(event: any) {
	try {
		const user = await verifyAuth(event)
		const formData = await event.request.formData()
		const file = formData.get('file') as File | null
		if (!file) throw new ValidationError('No file')
		if (file.size > 20 * 1024 * 1024) throw new ValidationError('File too large (max 20MB)')

		const now = new Date()
		const ext = file.name.split('.').pop()
		const r2Key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`
		const buffer = await file.arrayBuffer()
		await event.platform.env.R2.put(r2Key, buffer, { httpMetadata: { contentType: file.type } })

		const db = getDb(event)
		const record = await createMedia(db, {
			r2Key,
			originalName: file.name,
			mimeType: file.type,
			size: file.size,
			uploadedBy: user.userId,
		})
		return created(record)
	} catch (e) { return catchError(e) }
}
