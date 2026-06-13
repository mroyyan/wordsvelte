import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { categories } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  const db = getDb(event as any)
  const data = await db.select().from(categories).orderBy(categories.name)
  return json({ success: true, data })
}

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const body = await event.request.json()
    if (!body.name) return json({ success: false, error: 'Name required' }, 400)
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const db = getDb(event as any)
    const [cat] = await db.insert(categories).values({ name: body.name, slug, description: body.description || null, parentId: body.parentId || null }).returning()
    return json({ success: true, data: cat }, 201)
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
