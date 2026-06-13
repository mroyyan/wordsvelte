import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/response'
import { getComment, deleteComment } from '$lib/server/services/comment.service'

export async function GET(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const data = await getComment(db, parseInt(event.params.id))
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    await deleteComment(db, parseInt(event.params.id))
    return ok({})
  } catch (e) { return catchError(e) }
}
