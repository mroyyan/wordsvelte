import { getDb } from '$lib/server/db'
import { getSigningSecret, requireUser } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/response'
import { AppError, RateLimitError, ValidationError } from '$lib/server/errors'
import { accountPasswordByUser, twoFactorByUser, twoFactorSendByUser } from '$lib/server/limiters'
import { resolveMailer } from '$lib/server/mail-resolver'
import { getSettings } from '$lib/server/services/settings.service'
import { assertPassword } from '$lib/server/services/account.service'
import {
  beginTotpSetup, confirmEmail2fa, confirmTotpSetup, disableEmail2fa, disableTotp, getTwoFactorStatus,
  regenerateRecoveryCodes, sendEmailCode,
} from '$lib/server/services/two-factor.service'

export async function GET(event: any) {
  try {
    const me = await requireUser(event)
    return ok(await getTwoFactorStatus(getDb(event), me.userId))
  } catch (e) { return catchError(e) }
}

/** Turning anything off or minting new recovery codes needs the password again. */
async function confirmWithPassword(db: any, userId: number, password: unknown) {
  const key = String(userId)
  const wait = accountPasswordByUser.check(key)
  if (wait > 0) throw new RateLimitError(wait)
  try {
    await assertPassword(db, userId, password)
  } catch (e) {
    accountPasswordByUser.hit(key)
    throw e
  }
  accountPasswordByUser.reset(key)
}

const ACTIONS = ['totp-setup', 'totp-confirm', 'totp-disable', 'email-send', 'email-confirm', 'email-disable', 'recovery-regenerate']

export async function POST(event: any) {
  try {
    const me = await requireUser(event)
    const body = await readJson(event.request)
    const db = getDb(event)
    const secret = await getSigningSecret(event)
    const key = String(me.userId)
    const action = String(body.action)
    if (!ACTIONS.includes(action)) throw new ValidationError('Unknown action')

    // Code entry shares the sign-in limiter: guessing a 6-digit code is the one attack that matters here.
    if (action.endsWith('-confirm')) {
      const wait = twoFactorByUser.check(key)
      if (wait > 0) throw new RateLimitError(wait)
    }

    switch (action) {
      case 'totp-setup': {
        const settings = await getSettings(db)
        return ok(await beginTotpSetup(db, secret, me.userId, settings.site_name || 'WordSvelte'))
      }
      case 'totp-confirm': {
        try { return ok(await confirmTotpSetup(db, secret, me.userId, String(body.code ?? ''))) }
        catch (e) { twoFactorByUser.hit(key); throw e }
      }
      case 'totp-disable':
        await confirmWithPassword(db, me.userId, body.password)
        await disableTotp(db, me.userId)
        return ok(await getTwoFactorStatus(db, me.userId))
      case 'email-send': {
        const wait = twoFactorSendByUser.check(key)
        if (wait > 0) throw new RateLimitError(wait)
        twoFactorSendByUser.hit(key)
        const settings = await getSettings(db)
        try {
          await sendEmailCode(db, secret, me.userId, 'enable', await resolveMailer(db, event), settings.site_name || 'WordSvelte')
        } catch (e) {
          console.error('Failed to send the verification email:', e)
          throw new AppError('Could not send the email. Check Settings > Email first.', 502)
        }
        return ok({ sent: true })
      }
      case 'email-confirm': {
        try { return ok(await confirmEmail2fa(db, secret, me.userId, String(body.code ?? ''))) }
        catch (e) { twoFactorByUser.hit(key); throw e }
      }
      case 'email-disable':
        await confirmWithPassword(db, me.userId, body.password)
        await disableEmail2fa(db, me.userId)
        return ok(await getTwoFactorStatus(db, me.userId))
      default: {
        await confirmWithPassword(db, me.userId, body.password)
        const status = await getTwoFactorStatus(db, me.userId)
        if (!status.totpEnabled && !status.email2faEnabled) throw new ValidationError('Turn on two-factor authentication first')
        return ok({ recoveryCodes: await regenerateRecoveryCodes(db, secret, me.userId) })
      }
    }
  } catch (e) { return catchError(e) }
}
