import { error } from '@sveltejs/kit'
import { eq, desc, and, asc } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, tags, postTags, categories } from '@wordsvelte/shared'

export async function load(event) {
  const { params } = event
  const db = getDb(event)
  const [tag] = await db.select()
    .from(tags)
    .where(eq(tags.slug, params.slug))
    .limit(1)

  if (!tag) throw error(404, 'Tag not found')

  const tagPosts = await db.select()
    .from(posts)
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .where(and(eq(postTags.tagId, tag.id), eq(posts.status, 'publish')))
    .orderBy(desc(posts.publishedAt))

  const allCategories = await db.select().from(categories).orderBy(asc(categories.name))
  const allTags = await db.select().from(tags).orderBy(asc(tags.name))

  return { 
    tag, 
    posts: tagPosts.map((r: any) => r.posts),
    categories: allCategories,
    tags: allTags
  }
}
