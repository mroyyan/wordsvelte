import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/response'
import { getDashboard } from '$lib/server/services/dashboard.service'

/** Authors see numbers for their own posts; editors and admins see the whole site (admins also get the user count). */
export async function GET(event) {
  try {
    const user = await requireUser(event as any, 'author')
    return ok(await getDashboard(getDb(event as any), user))
  } catch (e) { return catchError(e) }
}
