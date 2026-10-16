import { describe, it, expect } from 'vitest'
import { createRateLimiter, clientKey } from '$lib/server/rate-limit'

function clock(start = 1_000_000) {
  let t = start
  return { now: () => t, advance: (ms: number) => { t += ms } }
}

describe('createRateLimiter', () => {
  it('allows up to max hits, then reports seconds until reset', () => {
    const c = clock()
    const rl = createRateLimiter({ max: 3, windowMs: 60_000, now: c.now })
    for (let i = 0; i < 3; i++) { expect(rl.check('k')).toBe(0); rl.hit('k') }
    expect(rl.check('k')).toBe(60)
    c.advance(30_000)
    expect(rl.check('k')).toBe(30)
  })

  it('opens again after the window passes', () => {
    const c = clock()
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: c.now })
    rl.hit('k')
    expect(rl.check('k')).toBeGreaterThan(0)
    c.advance(1001)
    expect(rl.check('k')).toBe(0)
    rl.hit('k')
    expect(rl.check('k')).toBeGreaterThan(0) // new window counts from scratch
  })

  it('tracks keys independently and supports reset()', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 10_000 })
    rl.hit('a')
    expect(rl.check('a')).toBeGreaterThan(0)
    expect(rl.check('b')).toBe(0)
    rl.reset('a')
    expect(rl.check('a')).toBe(0)
  })

  it('does not block before max is reached', () => {
    const rl = createRateLimiter({ max: 5, windowMs: 10_000 })
    for (let i = 0; i < 4; i++) rl.hit('k')
    expect(rl.check('k')).toBe(0)
  })

  it('sweeps expired entries so memory stays bounded', () => {
    const c = clock()
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: c.now })
    for (let i = 0; i < 1500; i++) rl.hit('k' + i)
    c.advance(2000)
    rl.hit('fresh') // triggers sweep
    expect(rl.check('k0')).toBe(0)
    expect(rl.check('fresh')).toBeGreaterThan(0)
  })
})

describe('clientKey', () => {
  const req = (h: Record<string, string> = {}) => new Request('http://x', { headers: h })
  it('prefers getClientAddress, falls back to cf-connecting-ip, then unknown', () => {
    expect(clientKey({ request: req(), getClientAddress: () => '9.9.9.9' })).toBe('9.9.9.9')
    expect(clientKey({ request: req({ 'cf-connecting-ip': '8.8.8.8' }), getClientAddress: () => { throw new Error('no addr') } })).toBe('8.8.8.8')
    expect(clientKey({ request: req() })).toBe('unknown')
  })
})
