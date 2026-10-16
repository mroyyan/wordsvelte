import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, verifyDummyPassword, timingSafeEqual, passwordPolicyError } from '$lib/server/core/crypto'

/** The pre-refactor implementation (deriveKey/HMAC export). Existing stored hashes must keep verifying. */
async function legacyHash(password: string, salt: Uint8Array) {
  const hex = (b: Uint8Array) => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  const derived = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    key, { name: 'HMAC', hash: 'SHA-256', length: 256 }, true, ['sign'],
  )
  return `${hex(salt)}:${hex(new Uint8Array(await crypto.subtle.exportKey('raw', derived)))}`
}

describe('password hashing', () => {
  it('produces salt:hash hex and verifies the right password', async () => {
    const stored = await hashPassword('s3cret-passphrase')
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/)
    expect(await verifyPassword('s3cret-passphrase', stored)).toBe(true)
  })

  it('rejects wrong, empty and case-changed passwords', async () => {
    const stored = await hashPassword('s3cret-passphrase')
    expect(await verifyPassword('s3cret-passphrasE', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
    expect(await verifyPassword('s3cret-passphrase ', stored)).toBe(false)
  })

  it('uses a fresh salt each time', async () => {
    const [a, b] = await Promise.all([hashPassword('same'), hashPassword('same')])
    expect(a).not.toBe(b)
  })

  it('stays compatible with hashes created by the old implementation', async () => {
    const legacy = await legacyHash('old-user-password', new Uint8Array(16).fill(7))
    expect(await verifyPassword('old-user-password', legacy)).toBe(true)
    expect(await verifyPassword('nope', legacy)).toBe(false)
  })

  it.each(['', 'nocolon', ':', 'abc:', ':abc', 'zz:zz', 'a:b:c-garbage', 'xyz:00'])(
    'returns false (not throws) for malformed stored hash %j',
    async stored => {
      await expect(verifyPassword('anything', stored)).resolves.toBe(false)
    },
  )

  it('verifyDummyPassword always returns false', async () => {
    await expect(verifyDummyPassword('whatever')).resolves.toBe(false)
  })
})

describe('timingSafeEqual', () => {
  it('compares equal / different / different-length strings', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
    expect(timingSafeEqual('', '')).toBe(true)
    expect(timingSafeEqual('', 'a')).toBe(false)
  })
})

describe('passwordPolicyError', () => {
  it('enforces 8..128 characters and string type', () => {
    expect(passwordPolicyError('1234567')).toMatch(/at least 8/)
    expect(passwordPolicyError('12345678')).toBeNull()
    expect(passwordPolicyError('x'.repeat(128))).toBeNull()
    expect(passwordPolicyError('x'.repeat(129))).toMatch(/at most 128/)
    expect(passwordPolicyError(undefined)).toMatch(/required/)
    expect(passwordPolicyError(12345678)).toMatch(/required/)
  })
})
