import { eq, desc, like, and } from 'drizzle-orm'
import { getDb } from '$lib/db'
import { posts } from '@kubus/shared/src/db-schema'

export async function load({ url, platform }) {
  const query = url.searchParams.get('q') || ''
  if (!query) return { query, results: [] }

  const db = getDb(platform)
  const results = await db.select()
    .from(posts)
    .where(and(eq(posts.status, 'publish'), like(posts.title, `%${query}%`)))
    .orderBy(desc(posts.publishedAt))
    .limit(50)

  return { query, results }
}
