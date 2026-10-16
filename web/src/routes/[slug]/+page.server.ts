import { getDb } from '$lib/server/db'
import { toKitError } from '$lib/server/http/load'
import { getPostOrPage } from '$lib/server/services/content/public-site.service'

export async function load(event) {
  try { return await getPostOrPage(getDb(event), event.params.slug) } catch (e) { toKitError(e) }
}
