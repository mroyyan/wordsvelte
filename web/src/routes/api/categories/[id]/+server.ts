import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { categories } from '@kubus/shared/src/db-schema'

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const body = await event.request.json()
    const db = getDb(event as any)
    const updateData: any = {}
    if (body.name) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    await db.update(categories).set(updateData).where(eq(categories.id, id))
    const [cat] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
    return json({ success: true, data: cat })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    await db.delete(categories).where(eq(categories.id, id))
    return json({ success: true })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
