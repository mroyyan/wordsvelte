import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { okPaginated, catchError } from '$lib/server/response'
import { listComments } from '$lib/server/services/comment.service'

export async function GET(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const url = event.url
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const result = await listComments(db, { page, limit })
    return okPaginated(result.data, result.total, result.page, result.limit)
  } catch (e) { return catchError(e) }
}
