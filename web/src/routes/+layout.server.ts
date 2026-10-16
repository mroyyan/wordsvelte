import { getDb } from '$lib/server/db'
import { getSiteChrome } from '$lib/server/services/content/public-site.service'

export async function load(event) {
  return getSiteChrome(getDb(event as any), event.platform, event.url.origin)
}
