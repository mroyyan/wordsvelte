import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { catchError, okPaginated, created } from '$lib/server/response'
import { listPosts, createPost } from '$lib/server/services/post.service'

export async function GET(event) {
  try {
    const url = event.url
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const search = url.searchParams.get('q') || undefined
    const categoryId = url.searchParams.get('categoryId')

    const db = getDb(event as any)
    const { data, total } = await listPosts(db, {
      page,
      limit,
      search,
      categoryId: categoryId ? parseInt(categoryId) : undefined,
    })
    return okPaginated(data, total, page, limit)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    const user = await verifyAuth(event as any)
    const db = getDb(event as any)
    const body = await event.request.json()
    const post = await createPost(db, { ...body, authorId: user.userId })
    return created(post)
  } catch (e) { return catchError(e) }
}
