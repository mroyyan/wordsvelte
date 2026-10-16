/** RFC 6238 time-based one-time passwords (HMAC-SHA1, 30 s steps, 6 digits): what Google Authenticator, Authy, 1Password etc. implement. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const TOTP_STEP_SECONDS = 30
export const TOTP_DIGITS = 6

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

/** Tolerant of spaces, dashes, lowercase and padding (people paste secrets in all shapes). Null for invalid input. */
export function base32Decode(input: string): Uint8Array | null {
  const clean = input.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '')
  if (!clean) return null
  let bits = 0, value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) return null
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return new Uint8Array(out)
}

/** 160 bits, the size RFC 4226 recommends. */
export const generateTotpSecret = () => base32Encode(crypto.getRandomValues(new Uint8Array(20)))

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data as BufferSource))
}

/** RFC 4226 HOTP. */
export async function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): Promise<string> {
  const msg = new Uint8Array(8)
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter))
  const h = await hmacSha1(secret, msg)
  const offset = h[h.length - 1] & 0x0f
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

export const stepAt = (timeMs: number) => Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS)

export async function totpAt(secretBase32: string, timeMs: number, digits = TOTP_DIGITS): Promise<string> {
  const secret = base32Decode(secretBase32)
  if (!secret) throw new Error('Invalid TOTP secret')
  return hotp(secret, stepAt(timeMs), digits)
}

const safeEqual = (a: string, b: string) => {
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0)
  return diff === 0
}

/**
 * Accepts the current step and `window` steps either side (clock drift). `lastStep` is the newest step already
 * accepted for this user: anything at or before it is refused, so an intercepted code cannot be replayed.
 */
export async function verifyTotp(
  secretBase32: string, code: string, opts: { now?: number; window?: number; lastStep?: number | null } = {},
): Promise<{ ok: boolean; step?: number }> {
  const normalized = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalized)) return { ok: false }
  const secret = base32Decode(secretBase32)
  if (!secret) return { ok: false }

  const current = stepAt(opts.now ?? Date.now())
  const window = opts.window ?? 1
  let matched: number | undefined
  // check every step in the window (no early exit) so timing does not reveal which one matched
  for (let step = current - window; step <= current + window; step++) {
    if (step < 0) continue
    if (safeEqual(await hotp(secret, step), normalized) && (opts.lastStep == null || step > opts.lastStep)) matched = step
  }
  return matched === undefined ? { ok: false } : { ok: true, step: matched }
}

/** The URI authenticator apps read from the QR code. */
export function otpauthUri(o: { secret: string; account: string; issuer: string }): string {
  const label = `${encodeURIComponent(o.issuer)}:${encodeURIComponent(o.account)}`
  const params = new URLSearchParams({ secret: o.secret, issuer: o.issuer, algorithm: 'SHA1', digits: String(TOTP_DIGITS), period: String(TOTP_STEP_SECONDS) })
  return `otpauth://totp/${label}?${params}`
}
