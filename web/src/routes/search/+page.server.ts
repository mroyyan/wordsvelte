import { eq, desc, like, and } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts } from '@wordsvelte/shared'

export async function load(event) {
  const url = new URL(event.request.url)
  const query = url.searchParams.get('q') || ''
  if (!query) return { query, results: [] }

  const db = getDb(event as any)
  const results = await db.select()
    .from(posts)
    .where(and(eq(posts.status, 'publish'), like(posts.title, `%${query}%`)))
    .orderBy(desc(posts.publishedAt))
    .limit(50)

  return { query, results }
}

