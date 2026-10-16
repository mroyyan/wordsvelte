import { and, desc, eq, sql } from 'drizzle-orm'
import { pages, toSlug } from '@wordsvelte/shared'
import { ConflictError, NotFoundError, ValidationError } from '$lib/server/core/errors'
import { sanitizeHtml } from '$lib/server/core/sanitize'
import { slugInUse, uniqueSlugAcross } from '$lib/server/services/content/slug.service'

export const PAGE_STATUSES = ['draft', 'publish'] as const
const MAX_TITLE_LENGTH = 300

export interface PageInput {
  title?: string
  slug?: string
  content?: string
  status?: string
}

export function validatePageStatus(status: unknown): 'draft' | 'publish' {
  if (!(PAGE_STATUSES as readonly string[]).includes(status as string)) {
    throw new ValidationError(`Status must be one of: ${PAGE_STATUSES.join(', ')}`)
  }
  return status as 'draft' | 'publish'
}

export async function listPages(db: any, opts: { status?: string } = {}) {
  const where = opts.status && opts.status !== 'all' ? eq(pages.status, validatePageStatus(opts.status)) : undefined
  return db.select().from(pages).where(where).orderBy(desc(sql`COALESCE(${pages.publishedAt}, ${pages.createdAt})`), desc(pages.id))
}

export async function getPageById(db: any, id: number) {
  const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1)
  if (!page) throw new NotFoundError('Page')
  return page
}

/** Public lookup: drafts are invisible. Content is sanitised again on the way out (imported/legacy rows). */
export async function getPublishedPageBySlug(db: any, slug: string) {
  const [page] = await db.select().from(pages).where(and(eq(pages.slug, slug), eq(pages.status, 'publish'))).limit(1)
  if (!page) return null
  return { ...page, content: sanitizeHtml(page.content) }
}

export async function createPage(db: any, data: PageInput & { title: string; authorId: number }) {
  const title = String(data.title ?? '').trim()
  if (!title) throw new ValidationError('Title is required')
  if (title.length > MAX_TITLE_LENGTH) throw new ValidationError(`Title too long (max ${MAX_TITLE_LENGTH} chars)`)
  const status = data.status === undefined ? 'draft' : validatePageStatus(data.status)

  let slug: string
  if (data.slug) {
    slug = toSlug(data.slug)
    if (!slug) throw new ValidationError('Invalid slug')
    if (await slugInUse(db, slug)) throw new ConflictError('Slug already in use (by a post, page, or reserved address)')
  } else {
    slug = await uniqueSlugAcross(db, title, {}, 'page')
  }

  const now = new Date().toISOString()
  const [page] = await db.insert(pages).values({
    authorId: data.authorId,
    title,
    slug,
    content: sanitizeHtml(data.content ?? ''),
    status,
    publishedAt: status === 'publish' ? now : null,
    createdAt: now,
    updatedAt: now,
  }).returning()
  return page
}

export async function updatePage(db: any, id: number, data: PageInput) {
  const existing = await getPageById(db, id)
  // Explicit allow-list, like posts: never spread the request body into the update.
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() }

  if (data.title !== undefined) {
    const title = String(data.title).trim()
    if (!title) throw new ValidationError('Title cannot be empty')
    if (title.length > MAX_TITLE_LENGTH) throw new ValidationError(`Title too long (max ${MAX_TITLE_LENGTH} chars)`)
    patch.title = title
  }
  if (data.content !== undefined) patch.content = sanitizeHtml(data.content)
  if (data.slug !== undefined && data.slug !== existing.slug) {
    const slug = toSlug(data.slug)
    if (!slug) throw new ValidationError('Invalid slug')
    if (await slugInUse(db, slug, { pageId: id })) throw new ConflictError('Slug already in use (by a post, page, or reserved address)')
    patch.slug = slug
  }
  if (data.status !== undefined) {
    patch.status = validatePageStatus(data.status)
    if (patch.status === 'publish' && !existing.publishedAt) patch.publishedAt = patch.updatedAt
  }

  await db.update(pages).set(patch).where(eq(pages.id, id))
  return getPageById(db, id)
}

/** Menu items pointing at the page are kept (their page_id becomes NULL via ON DELETE SET NULL) and simply stop showing publicly. */
export async function deletePage(db: any, id: number) {
  await getPageById(db, id)
  await db.delete(pages).where(eq(pages.id, id))
}
