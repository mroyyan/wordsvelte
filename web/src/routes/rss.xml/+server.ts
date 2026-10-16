import { desc, eq, sql } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, users, categories, postCategories } from '@wordsvelte/shared'
import { getSite } from '$lib/server/site'
import { rssXml } from '$lib/server/rss'
import { sanitizeHtml } from '$lib/server/sanitize'
import { parseStoredDate } from '$lib/format-date'
import { snippet, stripHtml } from '$lib/seo'

export async function GET(event) {
  const db = getDb(event as any)
  const site = await getSite(db, event.url.origin)

  const list = await db.select({
    id: posts.id, title: posts.title, slug: posts.slug, excerpt: posts.excerpt, content: posts.content,
    publishedAt: posts.publishedAt, createdAt: posts.createdAt, author: users.displayName,
  }).from(posts).leftJoin(users, eq(users.id, posts.authorId))
    .where(eq(posts.status, 'publish'))
    .orderBy(desc(sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`), desc(posts.id))
    .limit(50)

  const cats = list.length
    ? await db.select({ postId: postCategories.postId, name: categories.name }).from(postCategories).innerJoin(categories, eq(categories.id, postCategories.categoryId))
    : []
  const catsByPost = new Map<number, string[]>()
  for (const c of cats) catsByPost.set(c.postId, [...(catsByPost.get(c.postId) ?? []), c.name])

  const xml = rssXml(site, list.map((p: any) => ({
    title: p.title,
    link: `${site.origin}/${p.slug}`,
    description: p.excerpt ? snippet(stripHtml(p.excerpt), 300) : snippet(p.content, 300),
    contentHtml: sanitizeHtml(p.content),
    pubDate: parseStoredDate(p.publishedAt || p.createdAt),
    author: p.author,
    categories: catsByPost.get(p.id) ?? [],
  })))

  return new Response(site.hidden ? emptyFeed(site) : xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=900, s-maxage=3600' },
  })
}

/** When the site asks not to be indexed, don't hand its content to feed aggregators either. */
const emptyFeed = (site: Parameters<typeof rssXml>[0]) => rssXml(site, [])
