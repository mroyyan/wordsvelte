import { eq, desc, asc, sql } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, categories, tags } from '@wordsvelte/shared'

export async function load(event) {
  const db = getDb(event)
  const latest = await db.select()
    .from(posts)
    .where(eq(posts.status, 'publish'))
    .orderBy(desc(sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`))
    .limit(20)

  const allCategories = await db.select().from(categories).orderBy(asc(categories.name))
  const allTags = await db.select().from(tags).orderBy(asc(tags.name))

  return { posts: latest, categories: allCategories, tags: allTags }
}

