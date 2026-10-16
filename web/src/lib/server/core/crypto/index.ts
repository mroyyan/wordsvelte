const PBKDF2_ITERATIONS = 100_000 // Cloudflare Workers' WebCrypto caps PBKDF2 at 100k iterations
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(hex)) throw new Error('Invalid hex')
  const bytes = hex.match(/.{2}/g)!
  return new Uint8Array(bytes.map(b => parseInt(b, 16)))
}

/** Compare without early exit so response time doesn't reveal how many leading bytes matched. */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  const len = Math.max(x.length, y.length)
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return bytesToHex(new Uint8Array(bits))
}

export function passwordPolicyError(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required'
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  if (password.length > MAX_PASSWORD_LENGTH) return `Password must be at most ${MAX_PASSWORD_LENGTH} characters`
  return null
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `${bytesToHex(salt)}:${await derive(password, salt)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = (stored || '').split(':')
  if (!saltHex || !hashHex) return false
  let salt: Uint8Array
  try { salt = hexToBytes(saltHex) } catch { return false }
  return timingSafeEqual(await derive(password, salt), hashHex)
}

let dummyHash: Promise<string> | null = null
/** Burn the same CPU as a real check so unknown-email logins aren't distinguishable by timing. */
export async function verifyDummyPassword(password: string): Promise<false> {
  dummyHash ??= hashPassword('dummy-password-for-timing')
  await verifyPassword(password, await dummyHash)
  return false
}
