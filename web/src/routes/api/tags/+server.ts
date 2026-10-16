import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, created, catchError, readJson } from '$lib/server/response'
import { listTags, createTag } from '$lib/server/services/tag.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const data = await listTags(db)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    await requireUser(event as any, 'editor')
    const db = getDb(event as any)
    const body = await readJson(event.request)
    const tag = await createTag(db, body)
    return created(tag)
  } catch (e) { return catchError(e) }
}
