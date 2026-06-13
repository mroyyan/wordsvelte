import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { catchError, ok } from '$lib/server/response'
import { getPostById, updatePost, deletePost } from '$lib/server/services/post.service'

export async function GET(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const post = await getPostById(db, parseInt(event.params.id))
    return ok(post)
  } catch (e) { return catchError(e) }
}

export async function PATCH(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const body = await event.request.json()
    await updatePost(db, parseInt(event.params.id), body)
    return ok({})
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    await deletePost(db, parseInt(event.params.id))
    return ok({})
  } catch (e) { return catchError(e) }
}
