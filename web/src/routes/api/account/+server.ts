import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/http/response'
import { RateLimitError } from '$lib/server/core/errors'
import { accountPasswordByUser } from '$lib/server/http/limiters'
import { getProfile, updateProfile } from '$lib/server/services/account/account.service'

export async function GET(event: any) {
  try {
    const me = await requireUser(event)
    return ok(await getProfile(getDb(event), me.userId))
  } catch (e) { return catchError(e) }
}

/** Display name freely; changing the email also needs the current password. */
export async function PATCH(event: any) {
  try {
    const me = await requireUser(event)
    const wait = accountPasswordByUser.check(String(me.userId))
    if (wait > 0) throw new RateLimitError(wait)
    const body = await readJson(event.request)
    try {
      return ok(await updateProfile(getDb(event), me.userId, body))
    } catch (e: any) {
      if (e?.status === 403) accountPasswordByUser.hit(String(me.userId))
      throw e
    }
  } catch (e) { return catchError(e) }
}
