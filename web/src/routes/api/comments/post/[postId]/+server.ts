import { json } from '@sveltejs/kit'
import { eq, desc, and } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { comments } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  const postId = parseInt(event.params.postId)
  const db = getDb(event as any)
  const data = await db.select().from(comments).where(and(eq(comments.postId, postId), eq(comments.status, 'approved'))).orderBy(desc(comments.createdAt))
  return json({ success: true, data })
}
