import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { menus, menuItems } from '@kubus/shared/src/db-schema'

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const body = await event.request.json()
    const db = getDb(event as any)
    const updateData: any = {}
    if (body.name !== undefined) { updateData.name = body.name; updateData.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }
    if (body.location !== undefined) updateData.location = body.location
    if (body.status !== undefined) updateData.status = body.status
    updateData.updatedAt = "datetime('now')"
    await db.update(menus).set(updateData).where(eq(menus.id, id))
    const [menu] = await db.select().from(menus).where(eq(menus.id, id)).limit(1)
    const items = await db.select().from(menuItems).where(eq(menuItems.menuId, id)).orderBy(menuItems.sortOrder)
    return json({ success: true, data: { ...menu, items } })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    await db.delete(menuItems).where(eq(menuItems.menuId, id))
    await db.delete(menus).where(eq(menus.id, id))
    return json({ success: true })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
