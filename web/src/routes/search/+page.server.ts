import { getDb } from '$lib/server/db'
import { searchPosts } from '$lib/server/services/content/public-site.service'

export async function load(event) {
  return searchPosts(getDb(event as any), event.url.searchParams.get('q'))
}
