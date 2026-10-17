import { getDb } from '$lib/server/db'
import { getSiteChrome } from '$lib/server/services/content/public-site.service'

export async function load(event) {
  const chrome = await getSiteChrome(getDb(event as any), event.platform, event.url.origin, event.url.pathname)
  event.locals.lang = chrome.settings.language || 'id'
  return chrome
}
