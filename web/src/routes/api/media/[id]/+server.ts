import { getDb } from '$lib/server/db'
import { requireUser, hasRole } from '$lib/server/auth'
import { getMedia, deleteMedia } from '$lib/server/services/content/media.service'
import { ok, catchError } from '$lib/server/http/response'
import { ForbiddenError, ValidationError } from '$lib/server/core/errors'

function parseId(event: any): number {
	const id = Number(event.params.id)
	if (!Number.isInteger(id)) throw new ValidationError('Invalid id')
	return id
}

export async function GET(event: any) {
	try {
		await requireUser(event, 'author')
		return ok(await getMedia(getDb(event), parseId(event)))
	} catch (e) { return catchError(e) }
}

/** Authors may delete their own uploads; editors and admins may delete any. */
export async function DELETE(event: any) {
	try {
		const user = await requireUser(event, 'author')
		const db = getDb(event)
		const id = parseId(event)
		const record = await getMedia(db, id)
		if (!hasRole(user, 'editor') && record.uploadedBy !== user.userId) throw new ForbiddenError('You can only delete your own uploads')

		const r2Key = await deleteMedia(db, id)
		await event.platform?.env?.R2?.delete(r2Key)
		return ok({})
	} catch (e) { return catchError(e) }
}
