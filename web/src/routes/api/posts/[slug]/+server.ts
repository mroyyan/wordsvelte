import { getDb } from '$lib/server/db'
import { catchError, ok } from '$lib/server/http/response'
import { getPostBySlug } from '$lib/server/services/content/post.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const post = await getPostBySlug(db, event.params.slug)
    return ok(post)
  } catch (e) { return catchError(e) }
}
