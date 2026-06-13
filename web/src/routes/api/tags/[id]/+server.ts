import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { tags } from '@kubus/shared/src/db-schema'

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const body = await event.request.json()
    const db = getDb(event as any)
    await db.update(tags).set({ name: body.name }).where(eq(tags.id, id))
    const [tag] = await db.select().from(tags).where(eq(tags.id, id)).limit(1)
    return json({ success: true, data: tag })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    await db.delete(tags).where(eq(tags.id, id))
    return json({ success: true })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
