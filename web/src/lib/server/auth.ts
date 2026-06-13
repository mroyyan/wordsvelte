import { jwtVerify, SignJWT } from 'jose'
import type { RequestEvent } from '@sveltejs/kit'

function getSecret(event?: RequestEvent) {
  const secret = event?.platform?.env?.JWT_SECRET || 'local-dev-secret-change-in-production'
  return new TextEncoder().encode(secret)
}

export function createToken(payload: { userId: number; role: string }, event?: RequestEvent) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(getSecret(event))
}

export async function verifyAuth(event: RequestEvent) {
  const header = event.request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) throw new Error('Unauthorized')
  try {
    const { payload } = await jwtVerify(header.slice(7), getSecret(event))
    return payload as unknown as { userId: number; role: string }
  } catch {
    throw new Error('Invalid token')
  }
}
