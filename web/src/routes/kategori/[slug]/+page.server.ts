import { getDb } from '$lib/server/db'
import { toKitError } from '$lib/server/http/load'
import { getCategoryArchive } from '$lib/server/services/content/public-site.service'

export async function load(event) {
  try { return await getCategoryArchive(getDb(event), event.params.slug) } catch (e) { toKitError(e) }
}
