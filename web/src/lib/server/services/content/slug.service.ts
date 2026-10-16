import { eq } from 'drizzle-orm'
import { posts, pages, toSlug } from '@wordsvelte/shared'

/**
 * Posts and pages are both served from /<slug>, so a slug may only exist once across both tables.
 * Anything that is already a real route can never be a slug either.
 */
export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'kategori', 'tag', 'search', 'rss.xml', 'sitemap.xml', 'robots.txt', 'favicon.ico', 'favicon.png', '_app',
])

export interface SlugIgnore {
  postId?: number
  pageId?: number
}

export async function slugInUse(db: any, slug: string, ignore: SlugIgnore = {}): Promise<boolean> {
  if (RESERVED_SLUGS.has(slug)) return true
  const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1)
  if (post && post.id !== ignore.postId) return true
  const [page] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1)
  return !!page && page.id !== ignore.pageId
}

/** Normalise `base` to a slug and append -2, -3, ... until it is free everywhere. */
export async function uniqueSlugAcross(db: any, base: string, ignore: SlugIgnore = {}, fallback = 'post'): Promise<string> {
  const root = toSlug(base) || fallback
  if (!(await slugInUse(db, root, ignore))) return root
  for (let n = 2; n < 100; n++) {
    const candidate = `${root.slice(0, 190)}-${n}`
    if (!(await slugInUse(db, candidate, ignore))) return candidate
  }
  return `${root.slice(0, 180)}-${crypto.randomUUID().slice(0, 8)}`
}
