import { json } from '@sveltejs/kit'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, postCategories, postTags, categories, tags, comments } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  const slug = event.params.slug
  const db = getDb(event as any)
  const [post] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1)
  if (!post || post.status !== 'publish') return json({ success: false, error: 'Not found' }, 404)

  const catRows = await db.select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(postCategories).innerJoin(categories, eq(postCategories.categoryId, categories.id))
    .where(eq(postCategories.postId, post.id))
  const tagRows = await db.select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, post.id))
  const commentRows = await db.select().from(comments).where(eq(comments.postId, post.id)).orderBy(desc(comments.createdAt))

  await db.update(posts).set({ viewCount: post.viewCount + 1 }).where(eq(posts.id, post.id))
  return json({ success: true, data: { ...post, categories: catRows, tags: tagRows, comments: commentRows } })
}


