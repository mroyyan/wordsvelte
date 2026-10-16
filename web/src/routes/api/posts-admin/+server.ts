import { getDb } from '$lib/server/db'
import { requireUser, hasRole } from '$lib/server/auth'
import { catchError, okPaginated, parseIntParam } from '$lib/server/response'
import { listPosts } from '$lib/server/services/post.service'

export async function GET(event) {
  try {
    const user = await requireUser(event as any, 'author')
    const url = event.url
    const page = parseIntParam(url.searchParams.get('page'), 1)
    const limit = parseIntParam(url.searchParams.get('limit'), 20, { max: 500 })

    const { data, total } = await listPosts(getDb(event as any), {
      page,
      limit,
      status: url.searchParams.get('status') || 'all',
      // Authors only manage their own posts.
      authorId: hasRole(user, 'editor') ? undefined : user.userId,
    })
    return okPaginated(data, total, page, limit)
  } catch (e) { return catchError(e) }
}
