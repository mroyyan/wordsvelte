import { error } from '@sveltejs/kit'
import { and, asc, eq, desc, sql } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, postTags, tags, categories } from '@wordsvelte/shared'
import { sanitizeHtml } from '$lib/server/sanitize'
import { listCommentsByPost } from '$lib/server/services/comment.service'

export async function load(event) {
  const { params } = event
  const db = getDb(event)
  const [post] = await db.select().from(posts).where(eq(posts.slug, params.slug)).limit(1)
  if (!post || post.status !== 'publish') throw error(404, 'Not found')
  const postComments = await listCommentsByPost(db, post.id)
  const related = await db.select().from(posts).where(and(sql`id != ${post.id}`, eq(posts.status, 'publish'))).orderBy(sql`RANDOM()`).limit(3)
  const popular = await db.select().from(posts).where(eq(posts.status, 'publish')).orderBy(desc(posts.viewCount)).limit(5)
  const postTagsList = await db.select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id)).where(eq(postTags.postId, post.id))
  const allCategories = await db.select().from(categories).orderBy(asc(categories.name))
  const allTags = await db.select().from(tags).orderBy(asc(tags.name))
  await db.update(posts).set({ viewCount: sql`view_count + 1` }).where(eq(posts.id, post.id))
  return { post: { ...post, content: sanitizeHtml(post.content) }, comments: postComments, related, popular, tags: allTags, postTags: postTagsList, categories: allCategories }
}