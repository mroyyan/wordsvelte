import { getDb } from '$lib/server/db'
import { requireUser, getOptionalUser } from '$lib/server/auth'
import { getSettings, updateSettings } from '$lib/server/services/site/settings.service'
import { ok, catchError, readJson } from '$lib/server/http/response'

/** Public callers get the non-private settings; admins also see private ones. Secrets are never returned. */
export async function GET(event: any) {
	try {
		const user = await getOptionalUser(event)
		const data = await getSettings(getDb(event), { scope: user?.role === 'admin' ? 'admin' : 'public' })
		return ok(data)
	} catch (e) { return catchError(e) }
}

export async function PUT(event: any) {
	try {
		await requireUser(event, 'admin')
		await updateSettings(getDb(event), await readJson(event.request))
		return ok({})
	} catch (e) { return catchError(e) }
}
