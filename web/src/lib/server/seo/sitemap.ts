import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { posts, pages, categories, tags, postCategories, postTags } from '@wordsvelte/shared'
import { parseStoredDate } from '$lib/shared/format-date'

/** The sitemap protocol allows 50,000 URLs per file; far fewer keeps each file small and quick to build. */
export const POSTS_PER_SITEMAP = 1000
/** Google News only wants articles from the last two days. */
export const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000
export const NEWS_MAX_URLS = 1000

export interface UrlEntry { loc: string; lastmod?: string | null; changefreq?: string; priority?: string }

export const xmlEscape = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** Characters XML 1.0 cannot represent at all (control characters) are dropped, otherwise one bad title breaks the whole file. */
const clean = (s: unknown) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')

export const toIso = (v: string | null | undefined) => parseStoredDate(v)?.toISOString() ?? null

const HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n'

export function urlsetXml(entries: UrlEntry[]): string {
  const rows = entries.map(e =>
    `  <url>\n    <loc>${xmlEscape(clean(e.loc))}</loc>` +
    (e.lastmod ? `\n    <lastmod>${xmlEscape(e.lastmod)}</lastmod>` : '') +
    (e.changefreq ? `\n    <changefreq>${e.changefreq}</changefreq>` : '') +
    (e.priority ? `\n    <priority>${e.priority}</priority>` : '') +
    '\n  </url>')
  return `${HEADER}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}${rows.length ? '\n' : ''}</urlset>\n`
}

export function sitemapIndexXml(items: { loc: string; lastmod?: string | null }[]): string {
  const rows = items.map(i => `  <sitemap>\n    <loc>${xmlEscape(i.loc)}</loc>${i.lastmod ? `\n    <lastmod>${xmlEscape(i.lastmod)}</lastmod>` : ''}\n  </sitemap>`)
  return `${HEADER}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}${rows.length ? '\n' : ''}</sitemapindex>\n`
}

export function newsSitemapXml(entries: { loc: string; title: string; publishedAt: string }[], publication: { name: string; language: string }): string {
  const rows = entries.map(e =>
    `  <url>\n    <loc>${xmlEscape(clean(e.loc))}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>${xmlEscape(clean(publication.name))}</news:name>\n        <news:language>${xmlEscape(publication.language)}</news:language>\n      </news:publication>\n      <news:publication_date>${xmlEscape(e.publishedAt)}</news:publication_date>\n      <news:title>${xmlEscape(clean(e.title))}</news:title>\n    </news:news>\n  </url>`)
  return `${HEADER}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${rows.join('\n')}${rows.length ? '\n' : ''}</urlset>\n`
}

export async function countPublishedPosts(db: any): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(posts).where(eq(posts.status, 'publish'))
  return Number(n)
}

export const postSitemapCount = (total: number) => Math.ceil(total / POSTS_PER_SITEMAP)

/** 1-based chunk of published posts, ordered by id so a chunk's contents never shift when new posts are added. */
export async function getPostEntries(db: any, origin: string, page: number): Promise<UrlEntry[]> {
  const rows = await db.select({ slug: posts.slug, updatedAt: posts.updatedAt, publishedAt: posts.publishedAt, createdAt: posts.createdAt })
    .from(posts).where(eq(posts.status, 'publish')).orderBy(asc(posts.id)).limit(POSTS_PER_SITEMAP).offset((page - 1) * POSTS_PER_SITEMAP)
  return rows.map((r: any) => ({ loc: `${origin}/${r.slug}`, lastmod: toIso(r.updatedAt) ?? toIso(r.publishedAt) ?? toIso(r.createdAt) }))
}

/** Home, published pages, and the categories/tags that actually contain published posts (empty ones are thin pages). */
export async function getStaticEntries(db: any, origin: string): Promise<UrlEntry[]> {
  const [latest] = await db.select({ d: sql<string>`MAX(COALESCE(${posts.updatedAt}, ${posts.createdAt}))` }).from(posts).where(eq(posts.status, 'publish'))
  const entries: UrlEntry[] = [{ loc: `${origin}/`, lastmod: toIso(latest?.d), changefreq: 'hourly', priority: '1.0' }]

  const staticPages = await db.select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(eq(pages.status, 'publish')).orderBy(asc(pages.id))
  for (const p of staticPages) entries.push({ loc: `${origin}/${p.slug}`, lastmod: toIso(p.updatedAt), changefreq: 'monthly', priority: '0.5' })

  const cats = await db.select({ slug: categories.slug }).from(categories)
    .where(sql`EXISTS (SELECT 1 FROM ${postCategories} pc JOIN ${posts} p ON p.id = pc.post_id WHERE pc.category_id = ${categories.id} AND p.status = 'publish')`)
    .orderBy(asc(categories.slug))
  for (const c of cats) entries.push({ loc: `${origin}/kategori/${c.slug}`, changefreq: 'daily', priority: '0.6' })

  const tg = await db.select({ slug: tags.slug }).from(tags)
    .where(sql`EXISTS (SELECT 1 FROM ${postTags} pt JOIN ${posts} p ON p.id = pt.post_id WHERE pt.tag_id = ${tags.id} AND p.status = 'publish')`)
    .orderBy(asc(tags.slug))
  for (const t of tg) entries.push({ loc: `${origin}/tag/${t.slug}`, changefreq: 'weekly', priority: '0.3' })

  return entries
}

/** Posts published within the last 48 hours, newest first, for the Google News sitemap. */
export async function getNewsEntries(db: any, origin: string, now = new Date()) {
  const when = sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`
  const cutoff = new Date(now.getTime() - NEWS_WINDOW_MS)
  // coarse date-prefix filter in SQL (works for every stored format), exact check below
  const rows = await db.select({ slug: posts.slug, title: posts.title, publishedAt: posts.publishedAt, createdAt: posts.createdAt })
    .from(posts).where(and(eq(posts.status, 'publish'), sql`substr(${when}, 1, 10) >= ${cutoff.toISOString().slice(0, 10)}`))
    .orderBy(desc(when), desc(posts.id)).limit(NEWS_MAX_URLS * 2)

  return rows
    .map((r: any) => ({ loc: `${origin}/${r.slug}`, title: r.title as string, date: parseStoredDate(r.publishedAt || r.createdAt) }))
    .filter((r: any) => r.date && r.date.getTime() >= cutoff.getTime() && r.date.getTime() <= now.getTime() + 60_000)
    .slice(0, NEWS_MAX_URLS)
    .map((r: any) => ({ loc: r.loc, title: r.title, publishedAt: r.date.toISOString() }))
}

/** robots.txt: block the admin, API and search results; point crawlers at the sitemaps. A hidden site blocks everything. */
export const buildRobotsTxt = (origin: string, hidden: boolean) =>
  hidden
    ? 'User-agent: *\nDisallow: /\n'
    : [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        'Disallow: /search',
        '',
        `Sitemap: ${origin}/sitemap.xml`,
        `Sitemap: ${origin}/sitemap-news.xml`,
        '',
      ].join('\n')

export const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  // cache in the browser briefly and at the edge longer; new posts show up within the hour
  'Cache-Control': 'public, max-age=900, s-maxage=3600',
}
