import { getDb } from '$lib/server/db'
import { createToken, requireUser, setAuthCookie } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/response'
import { RateLimitError } from '$lib/server/errors'
import { accountPasswordByUser } from '$lib/server/limiters'
import { changePassword } from '$lib/server/services/account.service'

/** Changes the password and signs out every other device; this browser stays signed in with a fresh token. */
export async function POST(event: any) {
  try {
    const me = await requireUser(event)
    const key = String(me.userId)
    const wait = accountPasswordByUser.check(key)
    if (wait > 0) throw new RateLimitError(wait)
    const body = await readJson(event.request)
    let sessionVersion: number
    try {
      ;({ sessionVersion } = await changePassword(getDb(event), me.userId, body.currentPassword, body.newPassword))
    } catch (e: any) {
      if (e?.status === 403) accountPasswordByUser.hit(key)
      throw e
    }
    accountPasswordByUser.reset(key)
    const token = await createToken({ userId: me.userId, role: me.role, sessionVersion }, event)
    setAuthCookie(event, token)
    return ok({ token })
  } catch (e) { return catchError(e) }
}
