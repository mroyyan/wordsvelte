import { createToken, setAuthCookie } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/response'
import { validateLogin, normalizeEmail } from '$lib/server/services/user.service'
import { getDb } from '$lib/server/db'
import { ValidationError, RateLimitError } from '$lib/server/errors'
import { clientKey } from '$lib/server/rate-limit'
import { loginByIp, loginByEmail } from '$lib/server/limiters'

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

    const token = await createToken({ userId: user.id, role: user.role }, event as any)
    setAuthCookie(event, token)
    return ok({ token, user })
  } catch (e) { return catchError(e) }
}
