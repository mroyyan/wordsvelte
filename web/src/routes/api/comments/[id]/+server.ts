import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { comments } from '@kubus/shared/src/db-schema'

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    await db.delete(comments).where(eq(comments.id, id))
    return json({ success: true })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
