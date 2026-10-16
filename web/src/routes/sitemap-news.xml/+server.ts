import { getDb } from '$lib/server/db'
import { getSite } from '$lib/server/site'
import { XML_HEADERS, getNewsEntries, newsSitemapXml } from '$lib/server/sitemap'

/** Google News sitemap: only articles from the last 48 hours. */
export async function GET(event) {
  const db = getDb(event as any)
  const site = await getSite(db, event.url.origin)
  const publication = { name: site.name, language: site.language }
  if (site.hidden) return new Response(newsSitemapXml([], publication), { headers: XML_HEADERS })
  return new Response(newsSitemapXml(await getNewsEntries(db, site.origin), publication), {
    // news changes quickly: shorter edge cache than the other sitemaps
    headers: { ...XML_HEADERS, 'Cache-Control': 'public, max-age=300, s-maxage=600' },
  })
}
