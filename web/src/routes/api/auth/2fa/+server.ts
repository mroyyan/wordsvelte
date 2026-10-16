import { createToken, getSigningSecret, setAuthCookie, verifyChallengeToken } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/http/response'
import { getDb } from '$lib/server/db'
import { AppError, RateLimitError } from '$lib/server/core/errors'
import { clientKey } from '$lib/server/http/rate-limit'
import { twoFactorByIp, twoFactorByUser, twoFactorSendByUser } from '$lib/server/http/limiters'
import { completeSignIn, sendSignInCode } from '$lib/server/services/account/sign-in.service'
import { getMailContext } from '$lib/server/services/site/mail.service'

/** POST { challenge, action: "send" } mails a sign-in code; POST { challenge, method, code } finishes the sign-in. */
export async function POST(event) {
  try {
    const body = await readJson(event.request)
    const db = getDb(event as any)
    const challenge = await verifyChallengeToken(body.challenge, event as any)
    const key = String(challenge.userId)
    const ip = clientKey(event)
    const secret = await getSigningSecret(event as any)

    if (body.action === 'send') {
      const wait = twoFactorSendByUser.check(key)
      if (wait > 0) throw new RateLimitError(wait)
      twoFactorSendByUser.hit(key)
      await sendSignInCode(db, challenge, { secret, mail: () => getMailContext(db, event) })
      return ok({ sent: true })
    }

    const wait = Math.max(twoFactorByUser.check(key), twoFactorByIp.check(ip))
    if (wait > 0) throw new RateLimitError(wait)

    const result = await completeSignIn(db, secret, challenge, body.method, body.code)
    if (!result.ok) {
      twoFactorByUser.hit(key)
      twoFactorByIp.hit(ip)
      throw new AppError('That code is not correct or has expired', 401)
    }
    twoFactorByUser.reset(key)

    const token = await createToken({ userId: result.user.id, role: result.user.role, sessionVersion: result.sessionVersion }, event as any)
    setAuthCookie(event, token)
    return ok({ token, user: result.user })
  } catch (e) { return catchError(e) }
}
