import { getDb } from '$lib/server/db'
import { ok, catchError } from '$lib/server/http/response'
import { getPublicWidgets } from '$lib/server/services/site/widget.service'

export async function GET(event) {
  try {
    const db = getDb(event as any)
    const data = await getPublicWidgets(db)
    return ok(data)
  } catch (e) { return catchError(e) }
}
