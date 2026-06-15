import { eq, desc, asc, and, sql } from 'drizzle-orm'
import { posts, postCategories, postTags, categories, tags, comments } from '@wordsvelte/shared'
import { toSlug } from '@wordsvelte/shared'
import { ValidationError, NotFoundError, AppError } from '$lib/server/errors'

interface ListPostsOpts {
  page: number
  limit: number
  search?: string
  categoryId?: number
  status?: string
}

interface CreatePostData {
  title: string
  content: string
  slug?: string
  excerpt?: string
  status?: string
  featuredImageUrl?: string
  isFeatured?: boolean
  categoryIds?: number[]
  tagIds?: number[]
  authorId: number
}

interface UpdatePostData {
  title?: string
  content?: string
  slug?: string
  excerpt?: string
  status?: string
  featuredImageUrl?: string
  isFeatured?: boolean
  categoryIds?: number[]
  tagIds?: number[]
}

export async function listPosts(db: any, opts: ListPostsOpts) {
  const { page, limit, search, categoryId, status } = opts
  const conditions: any[] = []
  const statusFilter = status || 'publish'
  conditions.push(eq(posts.status, statusFilter))
  if (search) conditions.push(sql`posts.title LIKE ${'%' + search + '%'}`)
  if (categoryId) conditions.push(sql`EXISTS (SELECT 1 FROM post_categories WHERE post_id = posts.id AND category_id = ${categoryId})`)

  const { total } = await db.select({ total: sql<number>`count(*)` }).from(posts).where(and(...conditions)).then((r: any[]) => r[0])
  const offset = (page - 1) * limit
  const data = await db.select().from(posts).where(and(...conditions)).orderBy(desc(posts.publishedAt)).limit(limit).offset(offset)

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getPostBySlug(db: any, slug: string) {
  const [post] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1)
  if (!post || post.status !== 'publish') throw new NotFoundError('Post')

  const catRows = await db.select({ id: categories.id, name: categories.name, slug: categories.slug })
    .from(postCategories).innerJoin(categories, eq(postCategories.categoryId, categories.id))
    .where(eq(postCategories.postId, post.id))
  const tagRows = await db.select({ id: tags.id, name: tags.name, slug: tags.slug })
    .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, post.id))
  const commentRows = await db.select().from(comments).where(eq(comments.postId, post.id)).orderBy(desc(comments.createdAt))

  await incrementViewCount(db, post.id)
  return { ...post, categories: catRows, tags: tagRows, comments: commentRows }
}

export async function getPostById(db: any, id: number) {
  const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
  if (!post) throw new NotFoundError('Post')

  const catRows = await db.select({ id: categories.id, name: categories.name })
    .from(postCategories).innerJoin(categories, eq(postCategories.categoryId, categories.id))
    .where(eq(postCategories.postId, post.id))
  const tagRows = await db.select({ id: tags.id, name: tags.name })
    .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, post.id))

  return { ...post, categories: catRows, tags: tagRows }
}

export async function createPost(db: any, data: CreatePostData) {
  if (!data.title || !data.content) throw new ValidationError('Title and content required')

  const slug = data.slug || toSlug(data.title)
  const [post] = await db.insert(posts).values({
    authorId: data.authorId,
    title: data.title,
    slug,
    excerpt: data.excerpt || null,
    content: data.content,
    status: data.status || 'draft',
    featuredImageUrl: data.featuredImageUrl || null,
    isFeatured: data.isFeatured || false,
    publishedAt: data.status === 'publish' ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }).returning()

  if (data.categoryIds?.length) await db.insert(postCategories).values(data.categoryIds.map((catId: number) => ({ postId: post.id, categoryId: catId })))
  if (data.tagIds?.length) await db.insert(postTags).values(data.tagIds.map((tagId: number) => ({ postId: post.id, tagId })))

  return post
}

export async function updatePost(db: any, id: number, data: UpdatePostData) {
  const [existing] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
  if (!existing) throw new NotFoundError('Post')

  const updateData: any = { ...data, updatedAt: new Date().toISOString() }
  delete updateData.categoryIds
  delete updateData.tagIds
  delete updateData.isFeatured

  await db.update(posts).set(updateData).where(eq(posts.id, id))

  // Handle featured toggle with max-5 enforcement
  if (data.isFeatured !== undefined && data.isFeatured !== existing.isFeatured) {
    await setFeaturedPosts(db, id, data.isFeatured)
  }

  if (data.categoryIds) {
    await db.delete(postCategories).where(eq(postCategories.postId, id))
    for (const catId of data.categoryIds) {
      await db.insert(postCategories).values({ postId: id, categoryId: catId })
    }
  }

  if (data.tagIds) {
    await db.delete(postTags).where(eq(postTags.postId, id))
    for (const tagId of data.tagIds) {
      await db.insert(postTags).values({ postId: id, tagId: tagId })
    }
  }
}

export async function deletePost(db: any, id: number) {
  await db.delete(posts).where(eq(posts.id, id))
}

export async function incrementViewCount(db: any, id: number) {
  await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, id))
}

export async function getRelatedPosts(db: any, postId: number) {
  const data = await db.select().from(posts)
    .where(and(
      eq(posts.status, 'publish'),
      sql`${posts.id} != ${postId}`,
      sql`EXISTS (SELECT 1 FROM post_categories pc1 WHERE pc1.post_id = ${posts.id} AND pc1.category_id IN (SELECT pc2.category_id FROM post_categories pc2 WHERE pc2.post_id = ${postId}))`
    ))
    .orderBy(sql`RANDOM()`).limit(3)

  return data
}

export async function getPopularPosts(db: any, limit: number = 5) {
  return db.select().from(posts)
    .where(eq(posts.status, 'publish'))
    .orderBy(desc(posts.viewCount))
    .limit(limit)
}

export async function getFeaturedPosts(db: any, limit: number = 5) {
  return db.select().from(posts)
    .where(eq(posts.isFeatured, true))
    .orderBy(desc(posts.publishedAt))
    .limit(limit)
}

export async function setFeaturedPosts(db: any, postId: number, isFeatured: boolean) {
  if (isFeatured) {
    // Count current featured posts
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(posts)
      .where(eq(posts.isFeatured, true))

    // If already 5, unmark the oldest
    if (count >= 5) {
      const oldest = await db.select({ id: posts.id })
        .from(posts)
        .where(eq(posts.isFeatured, true))
        .orderBy(asc(posts.publishedAt))
        .limit(1)
      if (oldest.length) {
        await db.update(posts).set({ isFeatured: false }).where(eq(posts.id, oldest[0].id))
      }
    }
  }

  await db.update(posts).set({ isFeatured, updatedAt: new Date().toISOString() }).where(eq(posts.id, postId))
}
