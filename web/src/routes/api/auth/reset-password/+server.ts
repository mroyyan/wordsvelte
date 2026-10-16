import { getDb } from '$lib/server/db'
import { ok, catchError, readJson } from '$lib/server/response'
import { RateLimitError } from '$lib/server/errors'
import { clientKey } from '$lib/server/rate-limit'
import { resetByIp } from '$lib/server/limiters'
import { isResetTokenValid, resetPassword } from '$lib/server/services/password-reset.service'

/** Lets the reset page check a link before showing the form. */
export async function GET(event) {
  try {
    return ok({ valid: await isResetTokenValid(getDb(event as any), event.url.searchParams.get('token')) })
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    const ip = clientKey(event)
    const wait = resetByIp.check(ip)
    if (wait > 0) throw new RateLimitError(wait)
    resetByIp.hit(ip)

    const body = await readJson(event.request)
    await resetPassword(getDb(event as any), body.token, body.password)
    return ok({ message: 'Password updated. You can now sign in.' })
  } catch (e) { return catchError(e) }
}
