import { json } from '@sveltejs/kit'
import { desc, sql } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { comments } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  try {
    await verifyAuth(event as any)
    const url = event.url
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const db = getDb(event as any)
    const offset = (page - 1) * limit
    const total = await db.select({ count: sql<number>`count(*)` }).from(comments).then(r => r[0].count)
    const data = await db.select().from(comments).orderBy(desc(comments.createdAt)).limit(limit).offset(offset)
    return json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
