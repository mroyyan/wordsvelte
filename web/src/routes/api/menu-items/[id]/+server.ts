import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { menuItems } from '@kubus/shared/src/db-schema'

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const body = await event.request.json()
    const db = getDb(event as any)
    const updateData: any = {}
    if (body.label !== undefined) updateData.label = body.label
    if (body.url !== undefined) updateData.url = body.url
    if (body.itemType !== undefined) updateData.itemType = body.itemType
    if (body.parentId !== undefined) updateData.parentId = body.parentId
    if (body.target !== undefined) updateData.target = body.target
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder
    if (body.status !== undefined) updateData.status = body.status
    await db.update(menuItems).set(updateData).where(eq(menuItems.id, id))
    const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1)
    return json({ success: true, data: item })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    await db.delete(menuItems).where(eq(menuItems.id, id))
    return json({ success: true })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
