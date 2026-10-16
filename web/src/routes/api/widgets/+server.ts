import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, created, catchError, readJson } from '$lib/server/http/response'
import { listWidgets, createWidget } from '$lib/server/services/site/widget.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const data = await listWidgets(db)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    await requireUser(event as any, 'admin')
    const db = getDb(event as any)
    const body = await readJson(event.request)
    const item = await createWidget(db, body)
    return created(item)
  } catch (e) { return catchError(e) }
}
