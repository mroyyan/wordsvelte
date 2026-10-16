import type { DbInstance } from '$lib/server/db'
import { POST_STATUSES, toSlug } from '@wordsvelte/shared'
import { ValidationError, NotFoundError, ConflictError } from '$lib/server/core/errors'
import { sanitizeHtml } from '$lib/server/core/sanitize'
import { slugInUse, uniqueSlugAcross } from '$lib/server/services/content/slug.service'
import { createPostRepository, type PostPatch } from '$lib/server/repositories/posts.repository'
import { createCategoryRepository } from '$lib/server/repositories/categories.repository'
import { createTagRepository } from '$lib/server/repositories/tags.repository'
import { createCommentRepository } from '$lib/server/repositories/comments.repository'

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

async function assertAllExist(countExisting: (ids: number[]) => Promise<number>, ids: number[], label: string) {
  if (!ids.length) return
  if ((await countExisting(ids)) !== ids.length) throw new ValidationError(`One or more ${label} do not exist`)
}

const slugTaken = (db: DbInstance, slug: string, excludeId?: number) => slugInUse(db, slug, { postId: excludeId })

/** Append -2, -3, ... until the slug is free across posts, pages and reserved addresses. */
const uniqueSlug = (db: DbInstance, base: string, excludeId?: number) => uniqueSlugAcross(db, base, { postId: excludeId })

export async function listPosts(db: DbInstance, opts: ListPostsOpts) {
  const page = Math.max(1, opts.page || 1)
  const limit = Math.min(500, Math.max(1, opts.limit || 20))
  const { search, categoryId, authorId } = opts
  const status = opts.status || 'publish'

  const { rows: data, total } = await createPostRepository(db).list({
    status: status !== 'all' ? validateStatus(status) : undefined,
    authorId,
    search,
    categoryId,
    limit,
    offset: (page - 1) * limit,
  })

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getPostBySlug(db: DbInstance, slug: string) {
  const posts = createPostRepository(db)
  const post = await posts.findBySlug(slug)
  if (!post || post.status !== 'publish') throw new NotFoundError('Post')

  const catRows = await posts.listCategoriesWithSlug(post.id)
  const tagRows = await posts.listTagsWithSlug(post.id)
  const commentRows = await createCommentRepository(db).listApprovedByPost(post.id)

  await incrementViewCount(db, post.id)
  return { ...post, content: sanitizeHtml(post.content), categories: catRows, tags: tagRows, comments: commentRows }
}

export async function getPostById(db: DbInstance, id: number) {
  const posts = createPostRepository(db)
  const post = await posts.findById(id)
  if (!post) throw new NotFoundError('Post')

  const catRows = await posts.listCategoryNames(post.id)
  const tagRows = await posts.listTagNames(post.id)

  return { ...post, categories: catRows, tags: tagRows }
}

export async function createPost(db: DbInstance, data: CreatePostData) {
  const title = String(data.title ?? '').trim()
  if (!title || !data.content) throw new ValidationError('Title and content required')
  if (title.length > MAX_TITLE_LENGTH) throw new ValidationError(`Title too long (max ${MAX_TITLE_LENGTH} chars)`)

  const status = data.status === undefined ? 'draft' : validateStatus(data.status)
  const categoryIds = validateIdList(data.categoryIds, 'categoryIds')
  const tagIds = validateIdList(data.tagIds, 'tagIds')
  await assertAllExist(ids => createCategoryRepository(db).countExisting(ids), categoryIds, 'categories')
  await assertAllExist(ids => createTagRepository(db).countExisting(ids), tagIds, 'tags')

  let slug: string
  if (data.slug) {
    slug = toSlug(data.slug)
    if (!slug) throw new ValidationError('Invalid slug')
    if (await slugTaken(db, slug)) throw new ConflictError('Slug already in use')
  } else {
    slug = await uniqueSlug(db, title)
  }

  const posts = createPostRepository(db)
  const now = new Date().toISOString()
  const post = await posts.insert({
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
  })

  await posts.insertCategoryLinks(post.id, categoryIds)
  await posts.insertTagLinks(post.id, tagIds)
  if (data.isFeatured) await setFeaturedPosts(db, post.id, true)

  return getPostById(db, post.id)
}

export async function updatePost(db: DbInstance, id: number, data: UpdatePostData) {
  const posts = createPostRepository(db)
  const existing = await posts.findById(id)
  if (!existing) throw new NotFoundError('Post')

  // Explicit allow-list: never spread the request body into the update (authorId, viewCount, etc. stay untouched).
  const patch: PostPatch = { updatedAt: new Date().toISOString() }

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
  if (categoryIds) await assertAllExist(ids => createCategoryRepository(db).countExisting(ids), categoryIds, 'categories')
  if (tagIds) await assertAllExist(ids => createTagRepository(db).countExisting(ids), tagIds, 'tags')

  await posts.update(id, patch)

  if (data.isFeatured !== undefined && Boolean(data.isFeatured) !== Boolean(existing.isFeatured)) {
    await setFeaturedPosts(db, id, Boolean(data.isFeatured))
  }

  if (categoryIds) {
    await posts.deleteCategoryLinks(id)
    await posts.insertCategoryLinks(id, categoryIds)
  }
  if (tagIds) {
    await posts.deleteTagLinks(id)
    await posts.insertTagLinks(id, tagIds)
  }
}

export async function deletePost(db: DbInstance, id: number) {
  const posts = createPostRepository(db)
  if (!(await posts.exists(id))) throw new NotFoundError('Post')
  await posts.delete(id)
}

export async function incrementViewCount(db: DbInstance, id: number) {
  await createPostRepository(db).incrementViews(id)
}

export async function getRelatedPosts(db: DbInstance, postId: number) {
  return createPostRepository(db).listRelated(postId, 3)
}

export async function getPopularPosts(db: DbInstance, limit: number = 5) {
  return createPostRepository(db).listPopular(limit)
}

export async function getFeaturedPosts(db: DbInstance, limit: number = MAX_FEATURED) {
  return createPostRepository(db).listFeatured(limit)
}

/** Mark/unmark a post as featured, keeping at most MAX_FEATURED published posts featured (oldest is dropped). */
export async function setFeaturedPosts(db: DbInstance, postId: number, isFeatured: boolean) {
  const posts = createPostRepository(db)
  if (isFeatured) {
    const count = await posts.countFeatured()
    const alreadyFeatured = await posts.isFeaturedPublished(postId)

    if (!alreadyFeatured && count >= MAX_FEATURED) {
      const overflow = count - MAX_FEATURED + 1
      for (const oldestId of await posts.listOldestFeaturedIds(postId, overflow)) await posts.unfeature(oldestId)
    }
  }

  await posts.setFeatured(postId, isFeatured, new Date().toISOString())
}
