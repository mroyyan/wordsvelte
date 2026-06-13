import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { created, catchError } from '$lib/server/response'
import { createComment } from '$lib/server/services/comment.service'

export async function POST(event) {
  try {
    const db = getDb(event as any)
    const body = await event.request.json()
    const comment = await createComment(db, body)
    return created(comment)
  } catch (e) { return catchError(e) }
}
