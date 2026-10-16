import type { DbInstance } from '$lib/server/db'
import { AppError, AuthError } from '$lib/server/core/errors'
import { createUserRepository } from '$lib/server/repositories/users.repository'
import type { MailContext } from '$lib/server/services/site/mail.service'
import { validateLogin } from '$lib/server/services/account/user.service'
import { availableMethods, getAuthState, sendEmailCode, verifySecondFactor, type SecondFactorMethod } from '$lib/server/services/account/two-factor.service'

export interface SignedInUser { id: number; email: string; username: string; displayName: string; role: string }

export type SignInResult =
  | { kind: 'authenticated'; user: SignedInUser; sessionVersion: number }
  | { kind: 'second-factor-required'; user: SignedInUser; sessionVersion: number; methods: SecondFactorMethod[]; emailSent: boolean }

export interface SignInOptions {
  secret: Uint8Array
  /** Loaded lazily: most sign-ins never send an email. */
  mail: () => Promise<MailContext>
  /** Asked before an email code is sent; returns false (and does not count) when the account is sending too many. */
  allowEmailCode: (userId: number) => boolean
}

/**
 * Password step. Returns a finished sign-in, or tells the caller that a second factor is still needed. When email is the
 * only second factor there is nothing for the person to type yet, so the code is sent right away; a delivery problem is
 * reported through `emailSent` instead of failing, because recovery codes still get them in.
 */
export async function signIn(db: DbInstance, creds: { email: string; password: string }, opts: SignInOptions): Promise<SignInResult> {
  const user = await validateLogin(db, creds.email, creds.password)
  const state = await getAuthState(db, user.id)
  const methods = availableMethods(state)
  if (methods.length === 0) return { kind: 'authenticated', user, sessionVersion: state.sessionVersion }

  let emailSent = false
  if (state.email2faEnabled && !state.totpEnabled && opts.allowEmailCode(user.id)) {
    try {
      const { mailer, siteName } = await opts.mail()
      await sendEmailCode(db, opts.secret, user.id, 'login', mailer, siteName)
      emailSent = true
    } catch (e) {
      console.error('Failed to send the sign-in verification email:', e)
    }
  }
  return { kind: 'second-factor-required', user, sessionVersion: state.sessionVersion, methods, emailSent }
}

const EXPIRED = 'Your sign-in session expired. Please sign in again.'

/** The person behind a challenge token, provided their password has not changed since the password step. */
async function userForChallenge(db: DbInstance, userId: number, sessionVersion: number) {
  const user = await createUserRepository(db).findById(userId)
  if (!user || user.sessionVersion !== sessionVersion) throw new AuthError(EXPIRED)
  return user
}

/** Mail a fresh sign-in code (the "send me a code" button on the second-factor screen). */
export async function sendSignInCode(db: DbInstance, challenge: { userId: number; sessionVersion: number }, opts: Pick<SignInOptions, 'secret' | 'mail'>) {
  const user = await userForChallenge(db, challenge.userId, challenge.sessionVersion)
  if (!availableMethods(user).includes('email')) throw new AppError('Email codes are not turned on for this account', 400)
  try {
    const { mailer, siteName } = await opts.mail()
    await sendEmailCode(db, opts.secret, user.id, 'login', mailer, siteName)
  } catch (e) {
    console.error('Failed to send the sign-in verification email:', e)
    throw new AppError('Could not send the email. Use your authenticator app or a recovery code instead.', 502)
  }
}

export type SecondFactorOutcome =
  | { ok: true; user: SignedInUser; sessionVersion: number }
  | { ok: false }

/** Check the second factor for a challenge. `ok: false` means a wrong or expired code (the caller counts the failure). */
export async function completeSignIn(
  db: DbInstance, secret: Uint8Array, challenge: { userId: number; sessionVersion: number }, method: unknown, code: unknown,
): Promise<SecondFactorOutcome> {
  const user = await userForChallenge(db, challenge.userId, challenge.sessionVersion)
  if (!(await verifySecondFactor(db, secret, user.id, method, code))) return { ok: false }
  const state = await getAuthState(db, user.id)
  return {
    ok: true,
    sessionVersion: state.sessionVersion,
    user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role },
  }
}
