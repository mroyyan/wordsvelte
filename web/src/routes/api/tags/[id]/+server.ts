import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, catchError, readJson } from '$lib/server/response'
import { updateTag, deleteTag } from '$lib/server/services/tag.service'

export async function PUT(event) {
  try {
    await requireUser(event as any, 'editor')
    const db = getDb(event as any)
    const body = await readJson(event.request)
    const data = await updateTag(db, parseInt(event.params.id), body)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await requireUser(event as any, 'editor')
    const db = getDb(event as any)
    await deleteTag(db, parseInt(event.params.id))
    return ok({})
  } catch (e) { return catchError(e) }
}
