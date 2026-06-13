import { jwtVerify, SignJWT } from 'jose'
import type { RequestEvent } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { settings } from '@wordsvelte/shared'

const JWT_SETTINGS_KEY = 'jwt_secret'
let cachedSecret: string | null = null

export const AUTH_COOKIE = 'wordsvelte_token'

async function getSecret(event?: RequestEvent): Promise<Uint8Array> {
  if (cachedSecret) return new TextEncoder().encode(cachedSecret)

  const platformSecret = event?.platform?.env?.JWT_SECRET
  if (platformSecret && platformSecret !== 'change-me-in-production') {
    cachedSecret = platformSecret
    return new TextEncoder().encode(cachedSecret)
  }

  const db = getDb(event as any)
  const rows = await db.select().from(settings).where(eq(settings.key, JWT_SETTINGS_KEY)).limit(1)

  if (rows.length > 0 && rows[0].value) {
    cachedSecret = rows[0].value
    return new TextEncoder().encode(cachedSecret)
  }

  const secret = crypto.randomUUID() + '-' + crypto.randomUUID()
  try {
    await db.insert(settings).values({ key: JWT_SETTINGS_KEY, value: secret }).onConflictDoNothing()
    const fresh = await db.select().from(settings).where(eq(settings.key, JWT_SETTINGS_KEY)).limit(1)
    cachedSecret = fresh[0]?.value || secret
  } catch {
    cachedSecret = secret
  }
  return new TextEncoder().encode(cachedSecret)
}

function getToken(event: RequestEvent): string | null {
  const header = event.request.headers.get('Authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)
  const cookie = event.cookies.get(AUTH_COOKIE)
  if (cookie) return cookie
  return null
}

export async function createToken(payload: { userId: number; role: string }, event?: RequestEvent) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(await getSecret(event))
}

export async function verifyAuth(event: RequestEvent) {
  const token = getToken(event)
  if (!token) throw new Error('Unauthorized')
  try {
    const { payload } = await jwtVerify(token, await getSecret(event))
    return payload as unknown as { userId: number; role: string }
  } catch {
    throw new Error('Invalid token')
  }
}

export function setAuthCookie(event: RequestEvent, token: string) {
  event.cookies.set(AUTH_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: event.url.protocol === 'https:',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export function clearAuthCookie(event: RequestEvent) {
  event.cookies.delete(AUTH_COOKIE, { path: '/' })
}
