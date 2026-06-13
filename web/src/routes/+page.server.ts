import { eq, desc, sql } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts } from '@kubus/shared/src/db-schema'

export async function load(event) {
  const db = getDb(event)
  const latest = await db.select()
    .from(posts)
    .where(eq(posts.status, 'publish'))
    .orderBy(desc(sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`))
    .limit(20)

  return { posts: latest }
}
