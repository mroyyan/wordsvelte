import { getDb } from '$lib/server/db'
import { getHomePage } from '$lib/server/services/content/public-site.service'

export async function load(event) {
  return getHomePage(getDb(event), { page: event.url.searchParams.get('page') })
}
