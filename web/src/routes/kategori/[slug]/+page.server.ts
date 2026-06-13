import { eq, desc, and, asc } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, categories, postCategories, tags } from '@wordsvelte/shared'

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

  const allCategories = await db.select().from(categories).orderBy(asc(categories.name))
  const allTags = await db.select().from(tags).orderBy(asc(tags.name))

  return { 
    category, 
    posts: catPosts.map(r => r.posts),
    categories: allCategories,
    tags: allTags
  }
}
