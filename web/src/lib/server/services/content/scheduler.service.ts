import type { DbInstance } from '$lib/server/db'
import { publishDuePosts } from '$lib/server/services/content/post.service'

/**
 * Cloudflare Pages has no cron triggers, so due posts are published by whoever happens to be asking: the first request
 * after the interval runs the (single, idempotent) UPDATE. A post therefore goes live within `intervalMs` of its time
 * as soon as anybody visits the site or the admin; with no visitors there is nobody to see it anyway.
 */
export const SCHEDULER_INTERVAL_MS = 30_000

// Per Worker isolate: a few isolates running the statement at once is harmless, it is guarded in SQL.
let lastRun = 0

export async function publishDueIfNeeded(db: DbInstance, now = Date.now(), intervalMs = SCHEDULER_INTERVAL_MS): Promise<number> {
  if (now - lastRun < intervalMs) return 0
  lastRun = now
  try {
    return await publishDuePosts(db, new Date(now))
  } catch (e) {
    // The scheduler must never break the page that happened to trigger it; try again next time.
    lastRun = 0
    console.error('Publishing scheduled posts failed:', e)
    return 0
  }
}

export function resetScheduler() {
  lastRun = 0
}
