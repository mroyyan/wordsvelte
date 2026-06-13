import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { widgets } from '@kubus/shared/src/db-schema'

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const body = await event.request.json()
    const db = getDb(event as any)
    const updateData: any = {}
    if (body.widgetType !== undefined) updateData.widgetType = body.widgetType
    if (body.title !== undefined) updateData.title = body.title
    if (body.content !== undefined) updateData.content = body.content
    if (body.settings !== undefined) updateData.settings = body.settings
    if (body.sidebarArea !== undefined) updateData.sidebarArea = body.sidebarArea
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder
    if (body.status !== undefined) updateData.status = body.status
    updateData.updatedAt = "datetime('now')"
    await db.update(widgets).set(updateData).where(eq(widgets.id, id))
    const [item] = await db.select().from(widgets).where(eq(widgets.id, id)).limit(1)
    return json({ success: true, data: item })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    await db.delete(widgets).where(eq(widgets.id, id))
    return json({ success: true })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
