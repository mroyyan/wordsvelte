import { getDb } from '$lib/server/db'
import { getSite } from '$lib/server/seo/site'
import { XML_HEADERS, getStaticEntries, urlsetXml } from '$lib/server/seo/sitemap'

export async function GET(event) {
  const db = getDb(event as any)
  const site = await getSite(db, event.url.origin)
  if (site.hidden) return new Response(urlsetXml([]), { headers: XML_HEADERS })
  return new Response(urlsetXml(await getStaticEntries(db, site.origin)), { headers: XML_HEADERS })
}
