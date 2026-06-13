import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/response'
import { updateWidget, deleteWidget } from '$lib/server/services/widget.service'

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const body = await event.request.json()
    const data = await updateWidget(db, parseInt(event.params.id), body)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    await deleteWidget(db, parseInt(event.params.id))
    return ok({})
  } catch (e) { return catchError(e) }
}
