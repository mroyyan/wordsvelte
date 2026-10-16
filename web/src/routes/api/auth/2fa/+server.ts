import { createToken, getSigningSecret, setAuthCookie, verifyChallengeToken } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/response'
import { getDb } from '$lib/server/db'
import { AppError, RateLimitError, ValidationError } from '$lib/server/errors'
import { clientKey } from '$lib/server/rate-limit'
import { twoFactorByIp, twoFactorByUser, twoFactorSendByUser } from '$lib/server/limiters'
import { resolveMailer } from '$lib/server/mail-resolver'
import { getSettings } from '$lib/server/services/settings.service'
import { availableMethods, getAuthState, sendEmailCode, verifySecondFactor } from '$lib/server/services/two-factor.service'
import { users } from '@wordsvelte/shared'
import { eq } from 'drizzle-orm'

/** Resolve the challenge token to a user whose password step is still valid (a password change since then voids it). */
async function challengeUser(event: any, db: any, token: unknown) {
  const { userId, sessionVersion } = await verifyChallengeToken(token, event)
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user || user.sessionVersion !== sessionVersion) throw new AppError('Your sign-in session expired. Please sign in again.', 401)
  return user
}

/** POST { challenge, action: "send" } mails a sign-in code; POST { challenge, method, code } finishes the sign-in. */
export async function POST(event) {
  try {
    const body = await readJson(event.request)
    const db = getDb(event as any)
    const user = await challengeUser(event, db, body.challenge)
    const key = String(user.id)
    const ip = clientKey(event)
    const secret = await getSigningSecret(event as any)

    if (body.action === 'send') {
      if (!availableMethods(user).includes('email')) throw new ValidationError('Email codes are not turned on for this account')
      const wait = twoFactorSendByUser.check(key)
      if (wait > 0) throw new RateLimitError(wait)
      twoFactorSendByUser.hit(key)
      const settings = await getSettings(db)
      try {
        await sendEmailCode(db, secret, user.id, 'login', await resolveMailer(db, event), settings.site_name || 'WordSvelte')
      } catch (e) {
        console.error('Failed to send the sign-in verification email:', e)
        throw new AppError('Could not send the email. Use your authenticator app or a recovery code instead.', 502)
      }
      return ok({ sent: true })
    }

    const wait = Math.max(twoFactorByUser.check(key), twoFactorByIp.check(ip))
    if (wait > 0) throw new RateLimitError(wait)

    if (!(await verifySecondFactor(db, secret, user.id, body.method, body.code))) {
      twoFactorByUser.hit(key)
      twoFactorByIp.hit(ip)
      throw new AppError('That code is not correct or has expired', 401)
    }
    twoFactorByUser.reset(key)

    const state = await getAuthState(db, user.id)
    const token = await createToken({ userId: user.id, role: user.role, sessionVersion: state.sessionVersion }, event as any)
    setAuthCookie(event, token)
    return ok({ token, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role } })
  } catch (e) { return catchError(e) }
}
