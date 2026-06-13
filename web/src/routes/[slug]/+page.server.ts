import { error } from '@sveltejs/kit'
import { eq, desc, sql } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, comments, postTags, tags } from '@kubus/shared/src/db-schema'

export async function load(event) {
  const { params } = event
  const db = getDb(event)
  const [post] = await db.select().from(posts).where(eq(posts.slug, params.slug)).limit(1)
  if (!post || post.status !== 'publish') throw error(404, 'Not found')
  const postComments = await db.select().from(comments).where(eq(comments.postId, post.id)).orderBy(desc(comments.createdAt))
  const related = await db.select().from(posts).where(sql`id != ${post.id} AND status = 'publish'`).orderBy(sql`RANDOM()`).limit(3)
  const popular = await db.select().from(posts).where(eq(posts.status, 'publish')).orderBy(desc(posts.viewCount)).limit(5)
  const postTagsList = await db.select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id)).where(eq(postTags.postId, post.id))
  await db.update(posts).set({ viewCount: post.viewCount + 1 }).where(eq(posts.id, post.id))
  return { post, comments: postComments, related, popular, tags: postTagsList }
}