import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { catchError, okPaginated } from '$lib/server/response'
import { listPosts } from '$lib/server/services/post.service'

export async function GET(event) {
  try {
    await verifyAuth(event as any)
    const url = event.url
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status') || undefined

    const db = getDb(event as any)
    const { data, total } = await listPosts(db, { page, limit, status })
    return okPaginated(data, total, page, limit)
  } catch (e) { return catchError(e) }
}
