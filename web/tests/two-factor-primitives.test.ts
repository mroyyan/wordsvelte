import { describe, it, expect } from 'vitest'
import { sealSecret, openSecret } from '$lib/server/two-factor/secret-box'
import {
  base32Encode, base32Decode, generateTotpSecret, hotp, totpAt, verifyTotp, otpauthUri, stepAt,
} from '$lib/server/two-factor/totp'
import { randomDigits, generateRecoveryCode, normalizeRecoveryCode, hashCode } from '$lib/server/two-factor/codes'

const KEY = new TextEncoder().encode('test-secret-that-is-long-enough-123456')

describe('secret box (AES-GCM)', () => {
  it('round-trips, including unicode and empty-ish values', async () => {
    for (const text of ['hunter2', 'p@ss wörd 🔐 日本語', 'x'.repeat(5000)]) {
      expect(await openSecret(KEY, 'smtp', await sealSecret(KEY, 'smtp', text))).toBe(text)
    }
  })

  it('never produces the same box twice, and the plaintext is not visible in it', async () => {
    const a = await sealSecret(KEY, 'smtp', 'same')
    const b = await sealSecret(KEY, 'smtp', 'same')
    expect(a).not.toBe(b)
    expect(a).not.toContain('same')
    expect(a.startsWith('v1.')).toBe(true)
  })

  it('cannot be opened with another key, another purpose, or after tampering', async () => {
    const box = await sealSecret(KEY, 'smtp', 'secret')
    expect(await openSecret(new TextEncoder().encode('a-different-secret-key-entirely-00'), 'smtp', box)).toBeNull()
    expect(await openSecret(KEY, 'totp', box)).toBeNull()
    const [v, iv, ct] = box.split('.')
    expect(await openSecret(KEY, 'smtp', `${v}.${iv}.${ct.slice(0, -2)}AA`)).toBeNull()
    expect(await openSecret(KEY, 'smtp', `${v}.${ct}.${iv}`)).toBeNull()
  })

  it.each([null, undefined, '', 'garbage', 'v2.a.b', 'v1.', 'v1..'])('returns null (never throws) for %j', async v => {
    expect(await openSecret(KEY, 'smtp', v as any)).toBeNull()
  })
})

describe('base32', () => {
  it('matches the RFC 4648 test vectors', () => {
    const enc = (s: string) => base32Encode(new TextEncoder().encode(s))
    expect(enc('f')).toBe('MY')
    expect(enc('fo')).toBe('MZXQ')
    expect(enc('foo')).toBe('MZXW6')
    expect(enc('foob')).toBe('MZXW6YQ')
    expect(enc('fooba')).toBe('MZXW6YTB')
    expect(enc('foobar')).toBe('MZXW6YTBOI')
  })

  it('decodes tolerantly and rejects garbage', () => {
    const dec = (s: string) => new TextDecoder().decode(base32Decode(s)!)
    expect(dec('MZXW6YTBOI')).toBe('foobar')
    expect(dec('mzxw 6ytb-oi')).toBe('foobar')
    expect(dec('MZXW6YQ=')).toBe('foob')
    for (const bad of ['', '   ', '1', 'MZXW6!', '0189']) expect(base32Decode(bad)).toBeNull()
  })

  it('round-trips random bytes', () => {
    for (let i = 0; i < 20; i++) {
      const bytes = crypto.getRandomValues(new Uint8Array(1 + i * 3))
      expect(Array.from(base32Decode(base32Encode(bytes))!)).toEqual(Array.from(bytes))
    }
  })
})

describe('TOTP (RFC 6238 / RFC 4226 test vectors)', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' // ASCII "12345678901234567890"

  it('HOTP matches the RFC 4226 appendix D values', async () => {
    const key = new TextEncoder().encode('12345678901234567890')
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489']
    for (let i = 0; i < expected.length; i++) expect(await hotp(key, i)).toBe(expected[i])
  })

  it.each([
    [59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130'],
  ])('TOTP at unix time %i is %s', async (t, code) => {
    expect(await totpAt(rfcSecret, t * 1000)).toBe(code)
  })

  it('verifyTotp accepts the current code and one step of drift either way, but not more', async () => {
    const now = 1_700_000_000_000
    const code = await totpAt(rfcSecret, now)
    expect((await verifyTotp(rfcSecret, code, { now })).ok).toBe(true)
    expect((await verifyTotp(rfcSecret, code, { now: now + 30_000 })).ok).toBe(true)
    expect((await verifyTotp(rfcSecret, code, { now: now - 30_000 })).ok).toBe(true)
    expect((await verifyTotp(rfcSecret, code, { now: now + 120_000 })).ok).toBe(false)
  })

  it('refuses to accept the same step twice (replay protection) but accepts a later one', async () => {
    const now = 1_700_000_000_000
    const first = await verifyTotp(rfcSecret, await totpAt(rfcSecret, now), { now })
    expect(first.ok).toBe(true)
    expect((await verifyTotp(rfcSecret, await totpAt(rfcSecret, now), { now, lastStep: first.step })).ok).toBe(false)
    const later = now + 30_000
    expect((await verifyTotp(rfcSecret, await totpAt(rfcSecret, later), { now: later, lastStep: first.step })).ok).toBe(true)
  })

  it.each(['', '12345', '1234567', 'abcdef', '12 345', null, undefined, 123456 as any])('rejects malformed code %j', async code => {
    const now = 1_700_000_000_000
    const good = await totpAt(rfcSecret, now)
    expect((await verifyTotp(rfcSecret, code as any, { now })).ok).toBe(code === 123456 ? String(code) === good : false)
  })

  it('accepts a code typed with a space in the middle', async () => {
    const now = 1_700_000_000_000
    const code = await totpAt(rfcSecret, now)
    expect((await verifyTotp(rfcSecret, `${code.slice(0, 3)} ${code.slice(3)}`, { now })).ok).toBe(true)
  })

  it('an invalid stored secret simply fails verification', async () => {
    expect((await verifyTotp('!!!', '123456')).ok).toBe(false)
  })

  it('generates 160-bit secrets that decode back and are unique', () => {
    const a = generateTotpSecret()
    expect(a).toMatch(/^[A-Z2-7]{32}$/)
    expect(base32Decode(a)).toHaveLength(20)
    expect(generateTotpSecret()).not.toBe(a)
  })

  it('stepAt', () => { expect(stepAt(59_000)).toBe(1); expect(stepAt(60_000)).toBe(2) })

  it('otpauth URI carries issuer, account and parameters, URL-encoded', () => {
    const uri = otpauthUri({ secret: 'ABC234', account: 'jane+test@example.com', issuer: 'Kubus News & Co' })
    expect(uri.startsWith('otpauth://totp/Kubus%20News%20%26%20Co:jane%2Btest%40example.com?')).toBe(true)
    const q = new URL(uri).searchParams
    expect(q.get('secret')).toBe('ABC234')
    expect(q.get('issuer')).toBe('Kubus News & Co')
    expect(q.get('digits')).toBe('6')
    expect(q.get('period')).toBe('30')
    expect(q.get('algorithm')).toBe('SHA1')
  })
})

describe('codes', () => {
  it('randomDigits returns the right length, digits only, and is not constant', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) { const c = randomDigits(6); expect(c).toMatch(/^\d{6}$/); seen.add(c) }
    expect(seen.size).toBeGreaterThan(150)
    expect(randomDigits(8)).toMatch(/^\d{8}$/)
  })

  it('randomDigits is roughly uniform over 0-9 (no modulo bias)', () => {
    const counts = new Array(10).fill(0)
    for (let i = 0; i < 400; i++) for (const ch of randomDigits(50)) counts[Number(ch)]++
    for (const c of counts) expect(c).toBeGreaterThan(1700) // expected 2000 each of 20000
  })

  it('recovery codes look like xxxxx-xxxxx from a readable alphabet and are unique', () => {
    const codes = new Set(Array.from({ length: 200 }, generateRecoveryCode))
    expect(codes.size).toBe(200)
    for (const c of codes) expect(c).toMatch(/^[a-hj-km-np-z2-9]{5}-[a-hj-km-np-z2-9]{5}$/)
  })

  it('recovery codes are matched ignoring case, spaces and dashes', () => {
    expect(normalizeRecoveryCode('ABCDE-fghjk')).toBe('abcdefghjk')
    expect(normalizeRecoveryCode(' abcde fghjk ')).toBe('abcdefghjk')
    expect(normalizeRecoveryCode(null as any)).toBe('')
  })

  it('hashes are keyed and scoped', async () => {
    const a = await hashCode(KEY, 'login:1', '123456')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashCode(KEY, 'login:1', '123456')).toBe(a)
    expect(await hashCode(KEY, 'login:2', '123456')).not.toBe(a) // another user/purpose
    expect(await hashCode(new TextEncoder().encode('another-key-another-key-another-key'), 'login:1', '123456')).not.toBe(a)
    expect(await hashCode(KEY, 'login:1', '123457')).not.toBe(a)
  })
})
