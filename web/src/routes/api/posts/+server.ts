import { getDb } from '$lib/server/db'
import { requireUser, hasRole } from '$lib/server/auth'
import { catchError, okPaginated, created, parseIntParam, readJson } from '$lib/server/response'
import { listPosts, createPost } from '$lib/server/services/post.service'

export async function GET(event) {
  try {
    const url = event.url
    const page = parseIntParam(url.searchParams.get('page'), 1)
    const limit = parseIntParam(url.searchParams.get('limit'), 20, { max: 100 })
    const search = url.searchParams.get('q') || undefined
    const categoryId = parseIntParam(url.searchParams.get('categoryId'), 0, { min: 0 })

    const { data, total } = await listPosts(getDb(event as any), {
      page, limit, search, categoryId: categoryId || undefined,
    })
    return okPaginated(data, total, page, limit)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    const user = await requireUser(event as any, 'author')
    const body = await readJson(event.request)
    // Front-page curation is an editorial decision.
    const isFeatured = hasRole(user, 'editor') ? body.isFeatured : false
    const post = await createPost(getDb(event as any), { ...body, isFeatured, authorId: user.userId })
    return created(post)
  } catch (e) { return catchError(e) }
}
