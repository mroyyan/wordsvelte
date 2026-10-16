import { getDb } from '$lib/server/db'
import { getRssFeed } from '$lib/server/services/content/public-site.service'

export async function GET(event) {
  const xml = await getRssFeed(getDb(event as any), event.url.origin)
  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=900, s-maxage=3600' },
  })
}
