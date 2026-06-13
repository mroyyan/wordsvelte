import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { comments } from '@kubus/shared/src/db-schema'

export async function PATCH(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const body = await event.request.json()
    if (!['approved', 'pending', 'spam', 'trash'].includes(body.status))
      return json({ success: false, error: 'Invalid status' }, 400)
    const db = getDb(event as any)
    await db.update(comments).set({ status: body.status }).where(eq(comments.id, id))
    const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1)
    return json({ success: true, data: comment })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
