import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/http/response'
import { getComment, deleteComment } from '$lib/server/services/content/comment.service'

export async function GET(event) {
  try {
    await requireUser(event as any, 'editor')
    const db = getDb(event as any)
    const data = await getComment(db, parseInt(event.params.id))
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await requireUser(event as any, 'editor')
    const db = getDb(event as any)
    await deleteComment(db, parseInt(event.params.id))
    return ok({})
  } catch (e) { return catchError(e) }
}
