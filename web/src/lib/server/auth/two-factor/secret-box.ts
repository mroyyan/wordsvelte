/**
 * Authenticated encryption (AES-256-GCM) for secrets that must be stored but later read back: the SMTP password and
 * TOTP seeds. The key is derived (HKDF-SHA-256) from the site's signing secret (JWT_SECRET), so a copy of the database
 * alone is not enough to read them. Rotating JWT_SECRET makes existing boxes unreadable; callers treat that as
 * "please enter it again" rather than crashing.
 */

const INFO = new TextEncoder().encode('wordsvelte-secretbox-v1')
const VERSION = 'v1'

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))

async function deriveKey(secret: Uint8Array, purpose: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode(purpose) as BufferSource, info: INFO as BufferSource },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

/** `purpose` separates uses of the same secret (a box made for "smtp" cannot be opened as "totp"). */
export async function sealSecret(secret: Uint8Array, purpose: string, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(secret, purpose)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, new TextEncoder().encode(plaintext)))
  return `${VERSION}.${b64(iv)}.${b64(ct)}`
}

/** Returns null (never throws) when the box is malformed, was sealed for another purpose, or the key has changed. */
export async function openSecret(secret: Uint8Array, purpose: string, box: string | null | undefined): Promise<string | null> {
  if (!box) return null
  const [version, iv, ct] = box.split('.')
  if (version !== VERSION || !iv || !ct) return null
  try {
    const key = await deriveKey(secret, purpose)
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) as BufferSource }, key, unb64(ct) as BufferSource)
    return new TextDecoder().decode(pt)
  } catch {
    return null
  }
}
