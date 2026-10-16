import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, catchError, readJson } from '$lib/server/response'
import { updateCommentStatus } from '$lib/server/services/comment.service'

export async function PATCH(event) {
  try {
    await requireUser(event as any, 'editor')
    const db = getDb(event as any)
    const body = await readJson(event.request)
    const data = await updateCommentStatus(db, parseInt(event.params.id), body.status)
    return ok(data)
  } catch (e) { return catchError(e) }
}
