import { getDb } from '$lib/server/db'
import { getSite } from '$lib/server/seo/site'
import { resolveRobotsTxt } from '$lib/shared/seo'

export async function GET(event) {
  const site = await getSite(getDb(event as any), event.url.origin)
  return new Response(resolveRobotsTxt(site.origin, site.hidden, site.settings.robots_txt), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=900, s-maxage=3600' },
  })
}
