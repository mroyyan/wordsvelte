import { getDb } from '$lib/server/db'
import { getSite } from '$lib/server/site'
import { buildRobotsTxt } from '$lib/server/sitemap'

export async function GET(event) {
  const site = await getSite(getDb(event as any), event.url.origin)
  return new Response(buildRobotsTxt(site.origin, site.hidden), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=900, s-maxage=3600' },
  })
}
