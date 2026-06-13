import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { getSettings, updateSettings } from '$lib/server/services/settings.service'
import { ok, catchError } from '$lib/server/response'

export async function GET(event: any) {
	try {
		const db = getDb(event)
		const data = await getSettings(db)
		return ok(data)
	} catch (e) { return catchError(e) }
}

export async function PUT(event: any) {
	try {
		await verifyAuth(event)
		const body = await event.request.json()
		const db = getDb(event)
		await updateSettings(db, body)
		return ok({})
	} catch (e) { return catchError(e) }
}
