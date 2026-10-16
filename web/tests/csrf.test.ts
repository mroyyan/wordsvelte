import { describe, it, expect } from 'vitest'
import { isSameOrigin, isCsrfViolation } from '$lib/server/csrf'

const SERVER = 'https://news.example.com'
const check = (method: string, headers: Record<string, string> = {}, hasAuthCookie = false) =>
  isCsrfViolation({ method, headers: new Headers(headers), serverOrigin: SERVER, hasAuthCookie })

describe('isSameOrigin', () => {
  it('requires scheme, host and port to match', () => {
    expect(isSameOrigin('https://news.example.com', SERVER)).toBe(true)
    expect(isSameOrigin('https://news.example.com/some/page?x=1', SERVER)).toBe(true) // referer form
    expect(isSameOrigin('http://news.example.com', SERVER)).toBe(false)
    expect(isSameOrigin('https://news.example.com:8443', SERVER)).toBe(false)
    expect(isSameOrigin('https://evil.example.com', SERVER)).toBe(false)
    expect(isSameOrigin('https://news.example.com.evil.io', SERVER)).toBe(false)
    expect(isSameOrigin('null', SERVER)).toBe(false)
    expect(isSameOrigin('', SERVER)).toBe(false)
  })
})

describe('isCsrfViolation', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('never blocks safe method %s', m => {
    expect(check(m, { origin: 'https://evil.com' }, true)).toBe(false)
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s from same origin is fine', m => {
    expect(check(m, { origin: SERVER })).toBe(false)
  })

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s from another origin is blocked', m => {
    expect(check(m, { origin: 'https://evil.com' })).toBe(true)
  })

  it('treats Origin "null" (sandboxed iframes, redirects) as hostile', () => {
    expect(check('POST', { origin: 'null' })).toBe(true)
  })

  it('falls back to Referer when Origin is absent', () => {
    expect(check('POST', { referer: `${SERVER}/admin/posts` })).toBe(false)
    expect(check('POST', { referer: 'https://evil.com/attack' })).toBe(true)
  })

  it('blocks Sec-Fetch-Site: cross-site even with a matching Origin header', () => {
    expect(check('POST', { origin: SERVER, 'sec-fetch-site': 'cross-site' })).toBe(true)
    expect(check('POST', { origin: SERVER, 'sec-fetch-site': 'same-origin' })).toBe(false)
  })

  it('allows header-less requests only when they do not carry the auth cookie', () => {
    expect(check('POST', {}, false)).toBe(false) // curl / server-to-server with Bearer
    expect(check('POST', {}, true)).toBe(true) // cookie but no provenance: reject
  })
})
