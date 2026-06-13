import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/response'
import { updateCategory, deleteCategory } from '$lib/server/services/category.service'

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const body = await event.request.json()
    const data = await updateCategory(db, parseInt(event.params.id), body)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    await deleteCategory(db, parseInt(event.params.id))
    return ok({})
  } catch (e) { return catchError(e) }
}
