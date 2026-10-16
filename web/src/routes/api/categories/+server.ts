import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, created, catchError, readJson } from '$lib/server/http/response'
import { listCategories, createCategory } from '$lib/server/services/content/category.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const data = await listCategories(db)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    await requireUser(event as any, 'editor')
    const db = getDb(event as any)
    const body = await readJson(event.request)
    const cat = await createCategory(db, body)
    return created(cat)
  } catch (e) { return catchError(e) }
}
