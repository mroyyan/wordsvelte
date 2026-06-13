import { eq, desc } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts, settings } from '@wordsvelte/shared'

export async function GET(event) {
  const db = getDb(event as any)
  const list = await db.select()
    .from(posts)
    .where(eq(posts.status, 'publish'))
    .orderBy(desc(posts.publishedAt))
    .limit(50)

  const siteUrlRows = await db.select().from(settings).where(eq(settings.key, 'site_url')).limit(1)
  const siteUrl = siteUrlRows[0]?.value || 'https://wordsvelte.id'
  const siteNameRows = await db.select().from(settings).where(eq(settings.key, 'site_name')).limit(1)
  const siteName = siteNameRows[0]?.value || 'WordSvelte'

  const items = list.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${siteUrl}/${post.slug}</link>
      <description><![CDATA[${post.excerpt || ''}]]></description>
      <pubDate>${new Date(post.publishedAt || post.createdAt).toUTCString()}</pubDate>
      <guid>${siteUrl}/${post.slug}</guid>
    </item>
  `).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${siteName}</title>
    <link>${siteUrl}</link>
    <description>${siteName}</description>
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
