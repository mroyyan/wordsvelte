import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { comments } from '@kubus/shared/src/db-schema'

export async function POST(event) {
  const body = await event.request.json()
  if (!body.postId || !body.authorName || !body.authorEmail || !body.content)
    return json({ success: false, error: 'postId, authorName, authorEmail, content required' }, 400)
  const db = getDb(event as any)
  const [comment] = await db.insert(comments).values({
    postId: body.postId, authorName: body.authorName, authorEmail: body.authorEmail,
    content: body.content, parentId: body.parentId || null,
    createdAt: new Date().toISOString(),
  }).returning()
  return json({ success: true, data: comment }, 201)
}
