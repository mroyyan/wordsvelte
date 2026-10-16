import { getDb } from '$lib/server/db'
import { getSite } from '$lib/server/seo/site'
import { XML_HEADERS, countPublishedPosts, postSitemapCount, sitemapIndexXml } from '$lib/server/seo/sitemap'

/** Index of the real sitemaps: one for pages/categories/tags, one per 1,000 posts, and the Google News sitemap. */
export async function GET(event) {
  const db = getDb(event as any)
  const site = await getSite(db, event.url.origin)
  // A site that asked not to be indexed advertises nothing.
  if (site.hidden) return new Response(sitemapIndexXml([]), { headers: XML_HEADERS })

  const chunks = postSitemapCount(await countPublishedPosts(db))
  const items = [
    { loc: `${site.origin}/sitemap-pages.xml` },
    ...Array.from({ length: chunks }, (_, i) => ({ loc: `${site.origin}/sitemap-posts-${i + 1}.xml` })),
    { loc: `${site.origin}/sitemap-news.xml` },
  ]
  return new Response(sitemapIndexXml(items), { headers: XML_HEADERS })
}
