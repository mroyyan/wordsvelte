import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, catchError, readJson } from '$lib/server/http/response'
import { updateUser } from '$lib/server/services/account/user.service'

export async function PATCH(event) {
  try {
    const actor = await requireUser(event as any, 'admin')
    const body = await readJson(event.request)
    const updated = await updateUser(getDb(event as any), actor, Number(event.params.id), body)
    return ok(updated)
  } catch (e) { return catchError(e) }
}
