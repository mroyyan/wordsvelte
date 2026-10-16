import { jwtVerify, SignJWT } from 'jose'
import type { RequestEvent } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { settings, users, ROLES, type Role } from '@wordsvelte/shared'
import { AuthError, ForbiddenError } from '$lib/server/core/errors'

const JWT_SETTINGS_KEY = 'jwt_secret'
const PLACEHOLDER_SECRETS = new Set(['change-me-in-production', 'changeme', 'secret'])
const MIN_SECRET_LENGTH = 16
let cachedDbSecret: string | null = null

export const AUTH_COOKIE = 'wordsvelte_token'

export const ROLE_RANK: Record<Role, number> = { author: 1, editor: 2, admin: 3 }

export interface AuthUser {
  userId: number
  role: Role
  email: string
  username: string
  displayName: string
}

type EventLike = Pick<RequestEvent, 'request' | 'cookies' | 'platform'>

export function resetAuthCache() {
  cachedDbSecret = null
}

/** The site's signing secret; also the root of the keys that seal stored secrets (SMTP password, TOTP seeds). */
export async function getSigningSecret(event: EventLike): Promise<Uint8Array> {
  return getSecret(event)
}

async function getSecret(event: EventLike): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const platformSecret = event.platform?.env?.JWT_SECRET
  if (platformSecret && platformSecret.length >= MIN_SECRET_LENGTH && !PLACEHOLDER_SECRETS.has(platformSecret)) {
    return enc.encode(platformSecret)
  }

  // Production must be configured explicitly: a secret stored next to the data it protects is only OK for local dev.
  if (!import.meta.env.DEV) {
    throw new Error('JWT_SECRET is not configured (min 16 chars). Run: npx wrangler pages secret put JWT_SECRET --project-name <project>')
  }

  if (cachedDbSecret) return enc.encode(cachedDbSecret)
  const db = getDb(event)
  const rows = await db.select().from(settings).where(eq(settings.key, JWT_SETTINGS_KEY)).limit(1)
  if (rows.length > 0 && rows[0].value) {
    cachedDbSecret = rows[0].value
    return enc.encode(cachedDbSecret!)
  }

  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const secret = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  await db.insert(settings).values({ key: JWT_SETTINGS_KEY, value: secret }).onConflictDoNothing()
  const fresh = await db.select().from(settings).where(eq(settings.key, JWT_SETTINGS_KEY)).limit(1)
  cachedDbSecret = fresh[0]?.value || secret
  return enc.encode(cachedDbSecret!)
}

function getToken(event: EventLike): string | null {
  const header = event.request.headers.get('Authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return event.cookies.get(AUTH_COOKIE) ?? null
}

export async function createToken(payload: { userId: number; role: string; sessionVersion?: number }, event: EventLike) {
  return new SignJWT({ userId: payload.userId, role: payload.role, sv: payload.sessionVersion ?? 0, typ: 'session' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(await getSecret(event))
}

const CHALLENGE_TTL = '10m'

/**
 * Proof that the password step succeeded, handed to the browser while the second factor is pending.
 * It is NOT a session: requireUser rejects it (typ "2fa"), it expires in 10 minutes, and it is bound to the
 * session version so a password change in between invalidates it.
 */
export async function createChallengeToken(payload: { userId: number; sessionVersion: number }, event: EventLike) {
  return new SignJWT({ userId: payload.userId, sv: payload.sessionVersion, typ: '2fa' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(CHALLENGE_TTL)
    .sign(await getSecret(event))
}

export async function verifyChallengeToken(token: unknown, event: EventLike): Promise<{ userId: number; sessionVersion: number }> {
  if (typeof token !== 'string' || !token) throw new AuthError('Your sign-in session expired. Please sign in again.')
  try {
    const { payload } = await jwtVerify(token, await getSecret(event), { algorithms: ['HS256'] })
    if (payload.typ !== '2fa' || typeof payload.userId !== 'number') throw new Error('wrong token type')
    return { userId: payload.userId, sessionVersion: typeof payload.sv === 'number' ? payload.sv : 0 }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('JWT_SECRET')) throw e
    throw new AuthError('Your sign-in session expired. Please sign in again.')
  }
}

/**
 * Authenticate the request and load the user from the database, so a deleted user or a role
 * change takes effect immediately instead of when the 7-day token expires.
 * Throws AuthError (401) when unauthenticated, ForbiddenError (403) when below `minRole`.
 */
export async function requireUser(event: EventLike, minRole: Role = 'author'): Promise<AuthUser> {
  const token = getToken(event)
  if (!token) throw new AuthError('Unauthorized')

  let userId: unknown
  let sessionVersion = 0
  try {
    const { payload } = await jwtVerify(token, await getSecret(event), { algorithms: ['HS256'] })
    // 2FA challenge tokens (typ "2fa") are signed with the same key but must never work as a session
    if (payload.typ !== undefined && payload.typ !== 'session') throw new Error('not a session token')
    userId = payload.userId
    sessionVersion = typeof payload.sv === 'number' ? payload.sv : 0
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('JWT_SECRET')) throw e
    throw new AuthError('Invalid token')
  }
  if (typeof userId !== 'number') throw new AuthError('Invalid token')

  const [user] = await getDb(event).select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user || !ROLES.includes(user.role as Role)) throw new AuthError('Invalid token')
  // A password change / reset / security change bumps the version: every token issued before it stops working.
  if (user.sessionVersion !== sessionVersion) throw new AuthError('Your session has ended. Please sign in again.')

  const role = user.role as Role
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) throw new ForbiddenError('Insufficient permissions')

  return { userId: user.id, role, email: user.email, username: user.username, displayName: user.displayName }
}

/** The signed-in user, or null for anonymous/invalid credentials (other failures still throw). */
export async function getOptionalUser(event: EventLike): Promise<AuthUser | null> {
  try {
    return await requireUser(event, 'author')
  } catch (e) {
    if (e instanceof AuthError) return null
    throw e
  }
}

/** Back-compat alias: any authenticated user. Prefer requireUser(event, minRole). */
export const verifyAuth = (event: EventLike) => requireUser(event, 'author')

export function hasRole(user: Pick<AuthUser, 'role'>, minRole: Role): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[minRole]
}

export function setAuthCookie(event: Pick<RequestEvent, 'cookies' | 'url'>, token: string) {
  event.cookies.set(AUTH_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: event.url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearAuthCookie(event: Pick<RequestEvent, 'cookies'>) {
  event.cookies.delete(AUTH_COOKIE, { path: '/' })
}
