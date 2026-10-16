import { getDb } from '$lib/server/db'
import { ok, catchError, readJson } from '$lib/server/http/response'
import { RateLimitError } from '$lib/server/core/errors'
import { clientKey } from '$lib/server/http/rate-limit'
import { forgotByEmail, forgotByIp } from '$lib/server/http/limiters'
import { requestPasswordReset } from '$lib/server/services/account/password-reset.service'
import { normalizeEmail } from '$lib/server/services/account/user.service'
import { resolveMailer } from '$lib/server/services/site/mail.service'

const GENERIC = { message: 'If an account exists for that email, a reset link has been sent.' }

export async function POST(event) {
  try {
    const body = await readJson(event.request)
    const email = normalizeEmail(body.email)
    const ip = clientKey(event)

    const wait = Math.max(forgotByIp.check(ip), email ? forgotByEmail.check(email) : 0)
    if (wait > 0) throw new RateLimitError(wait)
    forgotByIp.hit(ip)
    if (email) forgotByEmail.hit(email)

    const db = getDb(event as any)
    await requestPasswordReset(db, email, {
      origin: event.url.origin,
      mailer: await resolveMailer(db, event),
    })
    // Same answer for known, unknown and malformed addresses.
    return ok(GENERIC)
  } catch (e) { return catchError(e) }
}
