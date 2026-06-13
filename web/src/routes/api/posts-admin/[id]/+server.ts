import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { posts, postCategories, postTags, categories, tags } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    
    const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
    if (!post) return json({ success: false, error: 'Post not found' }, 404)

    const catRows = await db.select({ id: categories.id, name: categories.name })
      .from(postCategories).innerJoin(categories, eq(postCategories.categoryId, categories.id))
      .where(eq(postCategories.postId, post.id))
    
    const tagRows = await db.select({ id: tags.id, name: tags.name })
      .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id))
      .where(eq(postTags.postId, post.id))

    return json({ success: true, data: { ...post, categories: catRows, tags: tagRows } })
  } catch (e: any) {
    return json({ success: false, error: e.message }, 401)
  }
}

export async function PATCH(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    const body = await event.request.json()

    const updateData: any = { ...body, updatedAt: new Date().toISOString() }
    delete updateData.categoryIds
    delete updateData.tagIds

    await db.update(posts).set(updateData).where(eq(posts.id, id))

    if (body.categoryIds) {
      await db.delete(postCategories).where(eq(postCategories.postId, id))
      for (const catId of body.categoryIds) {
        await db.insert(postCategories).values({ postId: id, categoryId: catId })
      }
    }

    if (body.tagIds) {
      await db.delete(postTags).where(eq(postTags.postId, id))
      for (const tagId of body.tagIds) {
        await db.insert(postTags).values({ postId: id, tagId: tagId })
      }
    }

    return json({ success: true })
  } catch (e: any) {
    return json({ success: false, error: e.message }, 401)
  }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    const db = getDb(event as any)
    await db.delete(posts).where(eq(posts.id, id))
    return json({ success: true })
  } catch (e: any) {
    return json({ success: false, error: e.message }, 401)
  }
}
