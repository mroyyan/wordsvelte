import { eq, desc } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { posts } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  const db = getDb(event as any)
  const list = await db.select()
    .from(posts)
    .where(eq(posts.status, 'publish'))
    .orderBy(desc(posts.publishedAt))
    .limit(50)

  const items = list.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>https://kubus.id/post/${post.slug}</link>
      <description><![CDATA[${post.excerpt || ''}]]></description>
      <pubDate>${new Date(post.publishedAt || post.createdAt).toUTCString()}</pubDate>
      <guid>https://kubus.id/post/${post.slug}</guid>
    </item>
  `).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Kubus News</title>
    <link>https://kubus.id</link>
    <description>Portal Berita Kubus</description>
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
