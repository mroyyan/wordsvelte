import { createChallengeToken, createToken, getSigningSecret, setAuthCookie } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/http/response'
import { validateLogin, normalizeEmail } from '$lib/server/services/account/user.service'
import { availableMethods, getAuthState, sendEmailCode } from '$lib/server/services/account/two-factor.service'
import { getDb } from '$lib/server/db'
import { ValidationError, RateLimitError } from '$lib/server/core/errors'
import { clientKey } from '$lib/server/http/rate-limit'
import { loginByIp, loginByEmail, twoFactorSendByUser } from '$lib/server/http/limiters'
import { resolveMailer } from '$lib/server/mail/resolver'
import { getSettings } from '$lib/server/services/site/settings.service'

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
    let user
    try {
      user = await validateLogin(db, email, body.password)
    } catch (e) {
      loginByIp.hit(ipKey)
      loginByEmail.hit(email)
      throw e
    }
    loginByEmail.reset(email)

    const state = await getAuthState(db, user.id)
    const methods = availableMethods(state)

    if (methods.length === 0) {
      const token = await createToken({ userId: user.id, role: user.role, sessionVersion: state.sessionVersion }, event as any)
      setAuthCookie(event, token)
      return ok({ token, user })
    }

    // Password is right but a second factor is required: hand out a short-lived challenge, not a session.
    const challenge = await createChallengeToken({ userId: user.id, sessionVersion: state.sessionVersion }, event as any)
    // With email as the only way in there is nothing to type yet, so send the code right away.
    let emailSent = false
    if (state.email2faEnabled && !state.totpEnabled && twoFactorSendByUser.check(String(user.id)) === 0) {
      twoFactorSendByUser.hit(String(user.id))
      try {
        const settings = await getSettings(db)
        await sendEmailCode(db, await getSigningSecret(event as any), user.id, 'login', await resolveMailer(db, event), settings.site_name || 'WordSvelte')
        emailSent = true
      } catch (e) {
        console.error('Failed to send the sign-in verification email:', e)
      }
    }
    return ok({ twoFactor: { challenge, methods, emailSent } })
  } catch (e) { return catchError(e) }
}
