import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { media } from '@kubus/shared/src/db-schema'

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    const [record] = await db.select().from(media).where(eq(media.id, id)).limit(1)
    if (!record) return json({ success: false, error: 'Not found' }, 404)
    await (event.platform as any).env.R2.delete(record.r2Key)
    await db.delete(media).where(eq(media.id, id))
    return json({ success: true })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
