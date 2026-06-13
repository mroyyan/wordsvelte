import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { menus, menuItems } from '@kubus/shared/src/db-schema'
import { asc, eq } from 'drizzle-orm'

export async function GET(event) {
  const db = getDb(event as any)
  const allMenus = await db.select().from(menus).orderBy(asc(menus.name))
  const result = []
  for (const menu of allMenus) {
    const items = await db.select().from(menuItems)
      .where(eq(menuItems.menuId, menu.id))
      .orderBy(asc(menuItems.sortOrder))
    result.push({ ...menu, items })
  }
  return json({ success: true, data: result })
}

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const body = await event.request.json()
    if (!body.name) return json({ success: false, error: 'Name required' }, 400)
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const db = getDb(event as any)
    const [menu] = await db.insert(menus).values({ name: body.name, slug, location: body.location || 'header' }).returning()
    return json({ success: true, data: { ...menu, items: [] } }, 201)
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
