function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = hex.match(/.{1,2}/g)
  if (!bytes) throw new Error('Invalid hex')
  return new Uint8Array(bytes.map(b => parseInt(b, 16)))
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, { name: 'HMAC', hash: 'SHA-256', length: 256 }, true, ['sign']
  )
  const raw = await crypto.subtle.exportKey('raw', derived)
  return `${bytesToHex(salt)}:${bytesToHex(new Uint8Array(raw))}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = hexToBytes(saltHex)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, { name: 'HMAC', hash: 'SHA-256', length: 256 }, true, ['sign']
  )
  const raw = await crypto.subtle.exportKey('raw', derived)
  return bytesToHex(new Uint8Array(raw)) === hashHex
}
