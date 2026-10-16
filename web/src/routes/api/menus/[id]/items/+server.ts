import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, created, catchError, readJson } from '$lib/server/response'
import { getMenuItems, createMenuItem } from '$lib/server/services/menu.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const data = await getMenuItems(db, parseInt(event.params.id))
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    await requireUser(event as any, 'admin')
    const db = getDb(event as any)
    const body = await readJson(event.request)
    const item = await createMenuItem(db, { ...body, menuId: parseInt(event.params.id) })
    return created(item)
  } catch (e) { return catchError(e) }
}
