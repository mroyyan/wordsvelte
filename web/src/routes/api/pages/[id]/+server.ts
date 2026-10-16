import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, catchError, readJson } from '$lib/server/response'
import { ValidationError } from '$lib/server/errors'
import { getPageById, updatePage, deletePage } from '$lib/server/services/page.service'

function parseId(event: any): number {
  const id = Number(event.params.id)
  if (!Number.isInteger(id)) throw new ValidationError('Invalid id')
  return id
}

export async function GET(event) {
  try {
    await requireUser(event as any, 'editor')
    return ok(await getPageById(getDb(event as any), parseId(event)))
  } catch (e) { return catchError(e) }
}

export async function PATCH(event) {
  try {
    await requireUser(event as any, 'editor')
    const body = await readJson(event.request)
    return ok(await updatePage(getDb(event as any), parseId(event), body))
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await requireUser(event as any, 'editor')
    await deletePage(getDb(event as any), parseId(event))
    return ok({})
  } catch (e) { return catchError(e) }
}
