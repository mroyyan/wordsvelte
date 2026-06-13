import { eq, desc, and } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, tags, postTags } from '@kubus/shared/src/db-schema'

export async function load(event) {
  const { params } = event
  const db = getDb(event)
  const [tag] = await db.select()
    .from(tags)
    .where(eq(tags.slug, params.slug))
    .limit(1)

  if (!tag) throw new Error('Tag not found')

  const tagPosts = await db.select()
    .from(posts)
    .innerJoin(postTags, eq(postTags.postId, posts.id))
    .where(and(eq(postTags.tagId, tag.id), eq(posts.status, 'publish')))
    .orderBy(desc(posts.publishedAt))

  return { tag, posts: tagPosts.map(r => r.posts) }
}