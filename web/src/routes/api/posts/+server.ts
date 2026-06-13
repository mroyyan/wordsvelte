import { json } from '@sveltejs/kit'
import { eq, desc, and, sql } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { posts, postCategories, postTags } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  const url = event.url
  const page = parseInt(url.searchParams.get('page') || '1')
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const search = url.searchParams.get('q') || ''
  const categoryId = url.searchParams.get('categoryId')

  const db = getDb(event as any)
  const conditions = [eq(posts.status, 'publish')]
  if (search) conditions.push(sql`posts.title LIKE ${'%' + search + '%'}`)
  if (categoryId) conditions.push(sql`EXISTS (SELECT 1 FROM post_categories WHERE post_id = posts.id AND category_id = ${parseInt(categoryId)})`)

  const { total } = await db.select({ total: sql<number>`count(*)` }).from(posts).where(and(...conditions)).then(r => r[0])
  const offset = (page - 1) * limit
  const data = await db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.publishedAt)).limit(limit).offset(offset)

  return json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) })
}

export async function POST(event) {
  try {
    const user = await verifyAuth(event as any)
    const db = getDb(event as any)
    const body = await event.request.json()

    if (!body.title || !body.content) return json({ success: false, error: 'Title and content required' }, 400)

    const slug = body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const [post] = await db.insert(posts).values({
      authorId: user.userId, title: body.title, slug, excerpt: body.excerpt || null,
      content: body.content, status: body.status || 'draft', featuredImageUrl: body.featuredImageUrl || null,
      publishedAt: body.status === 'publish' ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).returning()

    if (body.categoryIds?.length) await db.insert(postCategories).values(body.categoryIds.map((catId: number) => ({ postId: post.id, categoryId: catId })))
    if (body.tagIds?.length) await db.insert(postTags).values(body.tagIds.map((tagId: number) => ({ postId: post.id, tagId })))

    return json({ success: true, data: post }, 201)
  } catch (e: any) {
    return json({ success: false, error: e.message }, 401)
  }
}
