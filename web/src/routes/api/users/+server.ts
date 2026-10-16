import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { listUsers, createUser } from '$lib/server/services/user.service'
import { okPaginated, created, catchError, parseIntParam, readJson } from '$lib/server/response'

export async function GET(event: any) {
	try {
		await requireUser(event, 'admin')
		const page = parseIntParam(event.url.searchParams.get('page'), 1)
		const limit = parseIntParam(event.url.searchParams.get('limit'), 10, { max: 100 })
		const result = await listUsers(getDb(event), { page, limit })
		return okPaginated(result.data, result.total, result.page, result.limit)
	} catch (e) { return catchError(e) }
}

/** Admin-only account creation. There is no public self-registration. */
export async function POST(event: any) {
	try {
		await requireUser(event, 'admin')
		const body = await readJson(event.request)
		const user = await createUser(getDb(event), {
			email: body.email, username: body.username, password: body.password, displayName: body.displayName, role: body.role,
		})
		return created({ user })
	} catch (e) { return catchError(e) }
}
