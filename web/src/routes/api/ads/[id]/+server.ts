import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ValidationError } from '$lib/server/core/errors'
import { ok, catchError, readJson } from '$lib/server/http/response'
import { getAd, updateAd, deleteAd } from '$lib/server/services/site/ads.service'

function parseId(event: any): number {
  const id = Number(event.params.id)
  if (!Number.isInteger(id) || id < 1) throw new ValidationError('Invalid id')
  return id
}

export async function GET(event: any) {
  try {
    await requireUser(event, 'admin')
    return ok(await getAd(getDb(event), parseId(event)))
  } catch (e) { return catchError(e) }
}

export async function PATCH(event: any) {
  try {
    await requireUser(event, 'admin')
    return ok(await updateAd(getDb(event), parseId(event), await readJson(event.request)))
  } catch (e) { return catchError(e) }
}

export async function DELETE(event: any) {
  try {
    await requireUser(event, 'admin')
    await deleteAd(getDb(event), parseId(event))
    return ok({})
  } catch (e) { return catchError(e) }
}
