import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { ok, created, catchError } from '$lib/server/response'
import { listWidgets, createWidget } from '$lib/server/services/widget.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const data = await listWidgets(db)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const body = await event.request.json()
    const item = await createWidget(db, body)
    return created(item)
  } catch (e) { return catchError(e) }
}
