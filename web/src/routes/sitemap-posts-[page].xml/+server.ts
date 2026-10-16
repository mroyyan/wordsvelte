import { error } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { getSite } from '$lib/server/site'
import { XML_HEADERS, countPublishedPosts, getPostEntries, postSitemapCount, urlsetXml } from '$lib/server/sitemap'

export async function GET(event) {
  if (!/^[1-9]\d{0,5}$/.test(event.params.page)) throw error(404, 'Not found')
  const page = Number(event.params.page)

  const db = getDb(event as any)
  const site = await getSite(db, event.url.origin)
  if (site.hidden) return new Response(urlsetXml([]), { headers: XML_HEADERS })

  // chunk 1 always exists (it may be empty); later chunks only while there are posts for them
  if (page > Math.max(1, postSitemapCount(await countPublishedPosts(db)))) throw error(404, 'Not found')
  return new Response(urlsetXml(await getPostEntries(db, site.origin, page)), { headers: XML_HEADERS })
}
