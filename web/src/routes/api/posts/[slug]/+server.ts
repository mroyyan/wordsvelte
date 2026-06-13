import { json } from '@sveltejs/kit'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
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

export async function PUT(event) {
  try {
    const user = await verifyAuth(event as any)
    const id = parseInt(event.params.slug)
    if (isNaN(id)) return json({ success: false, error: 'Invalid ID' }, 400)

    const db = getDb(event as any)
    const body = await event.request.json()
    const updateData: any = {}
    if (body.title) updateData.title = body.title
    if (body.content !== undefined) updateData.content = body.content
    if (body.excerpt !== undefined) updateData.excerpt = body.excerpt
    if (body.status) { updateData.status = body.status; if (body.status === 'publish') updateData.publishedAt = new Date().toISOString() }
    if (body.featuredImageUrl !== undefined) updateData.featuredImageUrl = body.featuredImageUrl
    updateData.updatedAt = new Date().toISOString()

    await db.update(posts).set(updateData).where(eq(posts.id, id))
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
    return json({ success: true, data: post })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.slug)
    if (isNaN(id)) return json({ success: false, error: 'Invalid ID' }, 400)
    const db = getDb(event as any)
    await db.delete(posts).where(eq(posts.id, id))
    return json({ success: true })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
