import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/response'
import { updateCommentStatus } from '$lib/server/services/comment.service'

export async function PATCH(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const body = await event.request.json()
    const data = await updateCommentStatus(db, parseInt(event.params.id), body.status)
    return ok(data)
  } catch (e) { return catchError(e) }
}
