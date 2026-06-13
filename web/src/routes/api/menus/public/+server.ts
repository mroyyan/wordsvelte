import { json } from '@sveltejs/kit'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { menus, menuItems } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  const url = new URL(event.request.url)
  const location = url.searchParams.get('location') || 'header'
  const db = getDb(event as any)
  const allMenus = await db.select().from(menus)
    .where(eq(menus.status, 'active'))
    .orderBy(asc(menus.name))
  const result = []
  for (const menu of allMenus) {
    const items = await db.select().from(menuItems)
      .where(eq(menuItems.menuId, menu.id))
      .orderBy(asc(menuItems.sortOrder))
    result.push({ ...menu, items })
  }
  const filtered = result.filter(m => m.location === location)
  return json({ success: true, data: filtered })
}
