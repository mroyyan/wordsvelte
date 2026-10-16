import { createChallengeToken, createToken, getSigningSecret, setAuthCookie } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/http/response'
import { getDb } from '$lib/server/db'
import { ValidationError, RateLimitError } from '$lib/server/core/errors'
import { clientKey } from '$lib/server/http/rate-limit'
import { loginByIp, loginByEmail, twoFactorSendByUser } from '$lib/server/http/limiters'
import { normalizeEmail } from '$lib/server/services/account/user.service'
import { signIn } from '$lib/server/services/account/sign-in.service'
import { getMailContext } from '$lib/server/services/site/mail.service'

export async function POST(event) {
  try {
    const body = await readJson(event.request)
    if (typeof body.email !== 'string' || typeof body.password !== 'string' || !body.email || !body.password) {
      throw new ValidationError('Email and password required')
    }
    const email = normalizeEmail(body.email)
    const ipKey = clientKey(event)

    const wait = Math.max(loginByIp.check(ipKey), loginByEmail.check(email))
    if (wait > 0) throw new RateLimitError(wait)

    const db = getDb(event as any)
    let result
    try {
      result = await signIn(db, { email, password: body.password }, {
        secret: await getSigningSecret(event as any),
        mail: () => getMailContext(db, event),
        allowEmailCode: userId => {
          if (twoFactorSendByUser.check(String(userId)) > 0) return false
          twoFactorSendByUser.hit(String(userId))
          return true
        },
      })
    } catch (e) {
      loginByIp.hit(ipKey)
      loginByEmail.hit(email)
      throw e
    }
    loginByEmail.reset(email)

    if (result.kind === 'authenticated') {
      const token = await createToken({ userId: result.user.id, role: result.user.role, sessionVersion: result.sessionVersion }, event as any)
      setAuthCookie(event, token)
      return ok({ token, user: result.user })
    }

    // Password is right but a second factor is required: hand out a short-lived challenge, not a session.
    const challenge = await createChallengeToken({ userId: result.user.id, sessionVersion: result.sessionVersion }, event as any)
    return ok({ twoFactor: { challenge, methods: result.methods, emailSent: result.emailSent } })
  } catch (e) { return catchError(e) }
}
