import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { ok, created, catchError } from '$lib/server/response'
import { listCategories, createCategory } from '$lib/server/services/category.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const data = await listCategories(db)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const body = await event.request.json()
    const cat = await createCategory(db, body)
    return created(cat)
  } catch (e) { return catchError(e) }
}
