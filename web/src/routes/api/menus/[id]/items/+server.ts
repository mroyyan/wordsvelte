import { json } from '@sveltejs/kit'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { menuItems, menus } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  const menuId = parseInt(event.params.id)
  const db = getDb(event as any)
  const items = await db.select().from(menuItems)
    .where(eq(menuItems.menuId, menuId))
    .orderBy(asc(menuItems.sortOrder))
  return json({ success: true, data: items })
}

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const menuId = parseInt(event.params.id)
    const body = await event.request.json()
    if (!body.label) return json({ success: false, error: 'Label required' }, 400)
    const db = getDb(event as any)
    const [menu] = await db.select().from(menus).where(eq(menus.id, menuId)).limit(1)
    if (!menu) return json({ success: false, error: 'Menu not found' }, 404)
    const count = await db.select({ count: menuItems.id }).from(menuItems).where(eq(menuItems.menuId, menuId))
    const sortOrder = body.sortOrder ?? (count?.length || 0)
    const [item] = await db.insert(menuItems).values({
      menuId,
      parentId: body.parentId || null,
      itemType: body.itemType || 'custom',
      label: body.label,
      url: body.url || null,
      target: body.target || '_self',
      sortOrder,
    }).returning()
    return json({ success: true, data: item }, 201)
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
