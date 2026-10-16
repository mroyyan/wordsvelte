import { eq, desc, asc, and, sql, inArray } from 'drizzle-orm'
import { posts, postCategories, postTags, categories, tags, POST_STATUSES } from '@wordsvelte/shared'
import { toSlug } from '@wordsvelte/shared'
import { ValidationError, NotFoundError, ConflictError } from '$lib/server/core/errors'
import { sanitizeHtml } from '$lib/server/core/sanitize'
import { slugInUse, uniqueSlugAcross } from '$lib/server/services/content/slug.service'
import { publicCommentColumns } from '$lib/server/services/content/comment.service'
import { comments } from '@wordsvelte/shared'

const MAX_TITLE_LENGTH = 300
const MAX_FEATURED = 5

interface ListPostsOpts {
  page: number
  limit: number
  search?: string
  categoryId?: number
  authorId?: number
  /** Defaults to 'publish'. Pass 'all' to disable the status filter (admin views). */
  status?: string
}

interface PostInput {
  title?: string
  content?: string
  slug?: string
  excerpt?: string | null
  status?: string
  featuredImageUrl?: string | null
  isFeatured?: boolean
  categoryIds?: number[]
  tagIds?: number[]
}

interface CreatePostData extends PostInput {
  title: string
  content: string
  authorId: number
}

type UpdatePostData = PostInput

export function validateStatus(status: unknown): string {
  if (!(POST_STATUSES as readonly string[]).includes(status as string)) {
    throw new ValidationError(`Status must be one of: ${POST_STATUSES.join(', ')}`)
  }
  return status as string
}

/** Only same-site paths and http(s) URLs: blocks javascript:/data: URLs in image fields. */
function validateImageUrl(url: unknown): string | null {
  if (url === null || url === undefined || url === '') return null
  if (typeof url !== 'string' || url.length > 2048) throw new ValidationError('Invalid featured image URL')
  if (url.startsWith('/') && !url.startsWith('//')) return url
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' || u.protocol === 'https:') return url
  } catch {}
  throw new ValidationError('Invalid featured image URL')
}

function validateIdList(ids: unknown, field: string): number[] {
  if (ids === undefined) return []
  if (!Array.isArray(ids) || !ids.every(i => Number.isInteger(i) && i > 0)) {
    throw new ValidationError(`${field} must be an array of positive integers`)
  }
  return [...new Set(ids as number[])]
}

async function assertAllExist(db: any, table: any, ids: number[], label: string) {
  if (!ids.length) return
  const rows = await db.select({ id: table.id }).from(table).where(inArray(table.id, ids))
  if (rows.length !== ids.length) throw new ValidationError(`One or more ${label} do not exist`)
}

const slugTaken = (db: any, slug: string, excludeId?: number) => slugInUse(db, slug, { postId: excludeId })

/** Append -2, -3, ... until the slug is free across posts, pages and reserved addresses. */
const uniqueSlug = (db: any, base: string, excludeId?: number) => uniqueSlugAcross(db, base, { postId: excludeId })

const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => '\\' + c)

export async function listPosts(db: any, opts: ListPostsOpts) {
  const page = Math.max(1, opts.page || 1)
  const limit = Math.min(500, Math.max(1, opts.limit || 20))
  const { search, categoryId, authorId } = opts
  const status = opts.status || 'publish'

  const conditions: any[] = []
  if (status !== 'all') conditions.push(eq(posts.status, validateStatus(status)))
  if (authorId) conditions.push(eq(posts.authorId, authorId))
  if (search) conditions.push(sql`${posts.title} LIKE ${'%' + escapeLike(search) + '%'} ESCAPE '\\'`)
  if (categoryId) conditions.push(sql`EXISTS (SELECT 1 FROM post_categories WHERE post_id = ${posts.id} AND category_id = ${categoryId})`)
  const where = conditions.length ? and(...conditions) : undefined

  const { total } = await db.select({ total: sql<number>`count(*)` }).from(posts).where(where).then((r: any[]) => r[0])
  const data = await db.select().from(posts).where(where)
    .orderBy(desc(sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`), desc(posts.id))
    .limit(limit).offset((page - 1) * limit)

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
  const commentRows = await db.select(publicCommentColumns).from(comments)
    .where(and(eq(comments.postId, post.id), eq(comments.status, 'approved')))
    .orderBy(desc(comments.createdAt))

  await incrementViewCount(db, post.id)
  return { ...post, content: sanitizeHtml(post.content), categories: catRows, tags: tagRows, comments: commentRows }
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
  const title = String(data.title ?? '').trim()
  if (!title || !data.content) throw new ValidationError('Title and content required')
  if (title.length > MAX_TITLE_LENGTH) throw new ValidationError(`Title too long (max ${MAX_TITLE_LENGTH} chars)`)

  const status = data.status === undefined ? 'draft' : validateStatus(data.status)
  const categoryIds = validateIdList(data.categoryIds, 'categoryIds')
  const tagIds = validateIdList(data.tagIds, 'tagIds')
  await assertAllExist(db, categories, categoryIds, 'categories')
  await assertAllExist(db, tags, tagIds, 'tags')

  let slug: string
  if (data.slug) {
    slug = toSlug(data.slug)
    if (!slug) throw new ValidationError('Invalid slug')
    if (await slugTaken(db, slug)) throw new ConflictError('Slug already in use')
  } else {
    slug = await uniqueSlug(db, title)
  }

  const now = new Date().toISOString()
  const [post] = await db.insert(posts).values({
    authorId: data.authorId,
    title,
    slug,
    excerpt: data.excerpt ? sanitizeHtml(data.excerpt) : null,
    content: sanitizeHtml(data.content),
    status,
    featuredImageUrl: validateImageUrl(data.featuredImageUrl),
    isFeatured: false,
    publishedAt: status === 'publish' ? now : null,
    createdAt: now,
    updatedAt: now,
  }).returning()

  if (categoryIds.length) await db.insert(postCategories).values(categoryIds.map(categoryId => ({ postId: post.id, categoryId })))
  if (tagIds.length) await db.insert(postTags).values(tagIds.map(tagId => ({ postId: post.id, tagId })))
  if (data.isFeatured) await setFeaturedPosts(db, post.id, true)

  return getPostById(db, post.id)
}

export async function updatePost(db: any, id: number, data: UpdatePostData) {
  const [existing] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
  if (!existing) throw new NotFoundError('Post')

  // Explicit allow-list: never spread the request body into the update (authorId, viewCount, etc. stay untouched).
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }

  if (data.title !== undefined) {
    const title = String(data.title).trim()
    if (!title) throw new ValidationError('Title cannot be empty')
    if (title.length > MAX_TITLE_LENGTH) throw new ValidationError(`Title too long (max ${MAX_TITLE_LENGTH} chars)`)
    patch.title = title
  }
  if (data.content !== undefined) {
    if (!data.content) throw new ValidationError('Content cannot be empty')
    patch.content = sanitizeHtml(data.content)
  }
  if (data.excerpt !== undefined) patch.excerpt = data.excerpt ? sanitizeHtml(data.excerpt) : null
  if (data.featuredImageUrl !== undefined) patch.featuredImageUrl = validateImageUrl(data.featuredImageUrl)
  if (data.slug !== undefined && data.slug !== existing.slug) {
    const slug = toSlug(data.slug)
    if (!slug) throw new ValidationError('Invalid slug')
    if (await slugTaken(db, slug, id)) throw new ConflictError('Slug already in use')
    patch.slug = slug
  }
  if (data.status !== undefined) {
    patch.status = validateStatus(data.status)
    if (patch.status === 'publish' && !existing.publishedAt) patch.publishedAt = patch.updatedAt
  }

  const categoryIds = data.categoryIds !== undefined ? validateIdList(data.categoryIds, 'categoryIds') : null
  const tagIds = data.tagIds !== undefined ? validateIdList(data.tagIds, 'tagIds') : null
  if (categoryIds) await assertAllExist(db, categories, categoryIds, 'categories')
  if (tagIds) await assertAllExist(db, tags, tagIds, 'tags')

  await db.update(posts).set(patch).where(eq(posts.id, id))

  if (data.isFeatured !== undefined && Boolean(data.isFeatured) !== Boolean(existing.isFeatured)) {
    await setFeaturedPosts(db, id, Boolean(data.isFeatured))
  }

  if (categoryIds) {
    await db.delete(postCategories).where(eq(postCategories.postId, id))
    if (categoryIds.length) await db.insert(postCategories).values(categoryIds.map(categoryId => ({ postId: id, categoryId })))
  }
  if (tagIds) {
    await db.delete(postTags).where(eq(postTags.postId, id))
    if (tagIds.length) await db.insert(postTags).values(tagIds.map(tagId => ({ postId: id, tagId })))
  }
}

export async function deletePost(db: any, id: number) {
  const [existing] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).limit(1)
  if (!existing) throw new NotFoundError('Post')
  await db.delete(posts).where(eq(posts.id, id))
}

export async function incrementViewCount(db: any, id: number) {
  await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, id))
}

export async function getRelatedPosts(db: any, postId: number) {
  return db.select().from(posts)
    .where(and(
      eq(posts.status, 'publish'),
      sql`${posts.id} != ${postId}`,
      sql`EXISTS (SELECT 1 FROM post_categories pc1 WHERE pc1.post_id = ${posts.id} AND pc1.category_id IN (SELECT pc2.category_id FROM post_categories pc2 WHERE pc2.post_id = ${postId}))`,
    ))
    .orderBy(sql`RANDOM()`).limit(3)
}

export async function getPopularPosts(db: any, limit: number = 5) {
  return db.select().from(posts)
    .where(eq(posts.status, 'publish'))
    .orderBy(desc(posts.viewCount))
    .limit(limit)
}

export async function getFeaturedPosts(db: any, limit: number = MAX_FEATURED) {
  return db.select().from(posts)
    .where(and(eq(posts.isFeatured, true), eq(posts.status, 'publish')))
    .orderBy(desc(sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`))
    .limit(limit)
}

/** Mark/unmark a post as featured, keeping at most MAX_FEATURED published posts featured (oldest is dropped). */
export async function setFeaturedPosts(db: any, postId: number, isFeatured: boolean) {
  if (isFeatured) {
    const featured = and(eq(posts.isFeatured, true), eq(posts.status, 'publish'))
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(posts).where(featured)
    const [alreadyFeatured] = await db.select({ id: posts.id }).from(posts).where(and(featured, eq(posts.id, postId))).limit(1)

    if (!alreadyFeatured && count >= MAX_FEATURED) {
      const overflow = count - MAX_FEATURED + 1
      const oldest = await db.select({ id: posts.id }).from(posts)
        .where(and(featured, sql`${posts.id} != ${postId}`))
        .orderBy(asc(sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`), asc(posts.id))
        .limit(overflow)
      for (const row of oldest) await db.update(posts).set({ isFeatured: false }).where(eq(posts.id, row.id))
    }
  }

  await db.update(posts).set({ isFeatured, updatedAt: new Date().toISOString() }).where(eq(posts.id, postId))
}
