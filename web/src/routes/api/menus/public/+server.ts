import { getDb } from '$lib/server/db'
import { ok, catchError } from '$lib/server/http/response'
import { getPublicMenus } from '$lib/server/services/site/menu.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const data = await getPublicMenus(db)
    return ok(data)
  } catch (e) { return catchError(e) }
}
