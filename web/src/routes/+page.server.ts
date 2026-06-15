import { eq, desc, asc, sql } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, categories, tags } from '@wordsvelte/shared'
import { getSettings } from '$lib/server/services/settings.service'
import { getFeaturedPosts } from '$lib/server/services/post.service'

export async function load(event) {
  const db = getDb(event)
  const settings = await getSettings(db)
  const perPage = parseInt(settings.posts_per_page || '20')
  const page = parseInt(event.url.searchParams.get('page') || '1')
  const offset = (page - 1) * perPage
  const featuredPosts = await getFeaturedPosts(db, 5)

  const [{ total }] = await db.select({ total: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.status, 'publish'))

  const latest = await db.select()
    .from(posts)
    .where(eq(posts.status, 'publish'))
    .orderBy(desc(sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`))
    .limit(perPage)
    .offset(offset)

  const allCategories = await db.select().from(categories).orderBy(asc(categories.name))
  const allTags = await db.select().from(tags).orderBy(asc(tags.name))

  return {
    posts: latest,
    featuredPosts,
    categories: allCategories,
    tags: allTags,
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
  }
}

