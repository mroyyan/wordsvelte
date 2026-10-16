import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, catchError, readJson } from '$lib/server/http/response'
import { updateMenu, deleteMenu } from '$lib/server/services/site/menu.service'

export async function PUT(event) {
  try {
    await requireUser(event as any, 'admin')
    const db = getDb(event as any)
    const body = await readJson(event.request)
    const data = await updateMenu(db, parseInt(event.params.id), body)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await requireUser(event as any, 'admin')
    const db = getDb(event as any)
    await deleteMenu(db, parseInt(event.params.id))
    return ok({})
  } catch (e) { return catchError(e) }
}
