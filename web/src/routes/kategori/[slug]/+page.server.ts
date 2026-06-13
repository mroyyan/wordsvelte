import { eq, desc, and } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, categories, postCategories } from '@kubus/shared/src/db-schema'

export async function load(event) {
  const { params } = event
  const db = getDb(event)
  const [category] = await db.select()
    .from(categories)
    .where(eq(categories.slug, params.slug))
    .limit(1)

  if (!category) throw new Error('Category not found')

  const catPosts = await db.select()
    .from(posts)
    .innerJoin(postCategories, eq(postCategories.postId, posts.id))
    .where(and(eq(postCategories.categoryId, category.id), eq(posts.status, 'publish')))
    .orderBy(desc(posts.publishedAt))

  return { category, posts: catPosts.map(r => r.posts) }
}