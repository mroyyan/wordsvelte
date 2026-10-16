import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, created, catchError, readJson } from '$lib/server/response'
import { listMenus, createMenu } from '$lib/server/services/menu.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const data = await listMenus(db)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    await requireUser(event as any, 'admin')
    const db = getDb(event as any)
    const body = await readJson(event.request)
    const menu = await createMenu(db, body)
    return created(menu)
  } catch (e) { return catchError(e) }
}
