import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { listUsers } from '$lib/server/services/user.service'
import { okPaginated, catchError } from '$lib/server/response'

export async function GET(event: any) {
	try {
		await verifyAuth(event)
		const url = event.url
		const page = parseInt(url.searchParams.get('page') || '1')
		const limit = parseInt(url.searchParams.get('limit') || '10')
		const db = getDb(event)
		const result = await listUsers(db, { page, limit })
		return okPaginated(result.data, result.total, result.page, result.limit)
	} catch (e) { return catchError(e) }
}
