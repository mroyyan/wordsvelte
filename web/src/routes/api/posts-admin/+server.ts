import { json } from '@sveltejs/kit'
import { eq, desc, and, sql } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { posts } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  try {
    await verifyAuth(event as any)
    const url = event.url
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status')

    const db = getDb(event as any)
    const conditions: any[] = []
    if (status) conditions.push(eq(posts.status, status))

    const total = await db.select({ count: sql<number>`count(*)` }).from(posts).where(and(...conditions)).then(r => r[0].count)
    const offset = (page - 1) * limit
    const data = await db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.createdAt)).limit(limit).offset(offset)
    return json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
