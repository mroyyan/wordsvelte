import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { getMedia, deleteMedia } from '$lib/server/services/media.service'
import { ok, catchError } from '$lib/server/response'

export async function GET(event: any) {
	try {
		await verifyAuth(event)
		const db = getDb(event)
		const record = await getMedia(db, parseInt(event.params.id))
		return ok(record)
	} catch (e) { return catchError(e) }
}

export async function DELETE(event: any) {
	try {
		await verifyAuth(event)
		const db = getDb(event)
		const r2Key = await deleteMedia(db, parseInt(event.params.id))
		await event.platform.env.R2.delete(r2Key)
		return ok({})
	} catch (e) { return catchError(e) }
}
