/** Random one-time codes and their keyed hashes. */

/** Uniformly random digits (rejection sampling: no modulo bias). */
export function randomDigits(length = 6): string {
  let out = ''
  while (out.length < length) {
    const [n] = crypto.getRandomValues(new Uint32Array(1))
    if (n < 4_294_967_290) out += String(n % 10) // 4,294,967,290 = largest multiple of 10 that fits in 32 bits
  }
  return out
}

/** No 0/O/1/l/i: codes get read off a screen or paper. */
const RECOVERY_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  const chars = Array.from(bytes, b => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length])
  return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`
}

export const RECOVERY_CODE_COUNT = 10

/** Case, spaces and dashes don't matter when a person types a recovery code. */
export const normalizeRecoveryCode = (code: string) => String(code ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

/** HMAC-SHA-256 keyed with the site secret, so stolen hashes cannot be brute-forced offline without it. */
export async function hashCode(secret: Uint8Array, scope: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', secret as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${scope}:${code}`)))
  return Array.from(sig, b => b.toString(16).padStart(2, '0')).join('')
}
