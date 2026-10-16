import { getDb } from '$lib/server/db'
import { toKitError } from '$lib/server/http/load'
import { getTagArchive } from '$lib/server/services/content/public-site.service'

export async function load(event) {
  try { return await getTagArchive(getDb(event), event.params.slug) } catch (e) { toKitError(e) }
}
