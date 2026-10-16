import { jwtVerify, SignJWT } from 'jose'
import type { RequestEvent } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { settings, users, ROLES, type Role } from '@wordsvelte/shared'
import { AuthError, ForbiddenError } from '$lib/server/errors'

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

export async function createToken(payload: { userId: number; role: string }, event: EventLike) {
  return new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(await getSecret(event))
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
  try {
    const { payload } = await jwtVerify(token, await getSecret(event), { algorithms: ['HS256'] })
    userId = payload.userId
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('JWT_SECRET')) throw e
    throw new AuthError('Invalid token')
  }
  if (typeof userId !== 'number') throw new AuthError('Invalid token')

  const [user] = await getDb(event).select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user || !ROLES.includes(user.role as Role)) throw new AuthError('Invalid token')

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
