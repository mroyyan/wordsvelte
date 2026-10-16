export interface RateLimiter {
  /** Returns 0 if allowed, otherwise the number of seconds until the key may retry. */
  check(key: string): number
  /** Record one failed attempt (or one use) for the key. */
  hit(key: string): void
  reset(key: string): void
}

/**
 * Fixed-window in-memory limiter. State is per Worker isolate, so this is best-effort
 * brute-force friction, not a global guarantee; use Cloudflare rate-limiting rules for hard limits.
 */
export function createRateLimiter(opts: { max: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = opts.now ?? Date.now
  const entries = new Map<string, { count: number; resetAt: number }>()

  function sweep(t: number) {
    if (entries.size < 1000) return
    for (const [k, v] of entries) if (v.resetAt <= t) entries.delete(k)
  }

  return {
    check(key) {
      const t = now()
      const e = entries.get(key)
      if (!e || e.resetAt <= t) return 0
      return e.count >= opts.max ? Math.ceil((e.resetAt - t) / 1000) : 0
    },
    hit(key) {
      const t = now()
      sweep(t)
      const e = entries.get(key)
      if (!e || e.resetAt <= t) entries.set(key, { count: 1, resetAt: t + opts.windowMs })
      else e.count++
    },
    reset(key) {
      entries.delete(key)
    },
  }
}

export function clientKey(event: { getClientAddress?: () => string; request: Request }): string {
  try {
    return event.getClientAddress?.() || event.request.headers.get('cf-connecting-ip') || 'unknown'
  } catch {
    return event.request.headers.get('cf-connecting-ip') || 'unknown'
  }
}
