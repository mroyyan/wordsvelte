import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@wordsvelte/shared'
import type { RequestEvent } from '@sveltejs/kit'

// Intentionally typed loosely: D1 and better-sqlite3 share the query-builder API
// but have different result types (sync vs async), and services only `await` them.
export type DbInstance = any

let overrideDb: DbInstance | null = null

/** Install a database used when no D1 binding is present (local dev and tests). */
export function setDb(db: DbInstance | null) {
  overrideDb = db
}

/**
 * Local dev only. `import.meta.env.DEV` is statically false in production builds,
 * so better-sqlite3/fs never reach the Cloudflare Worker bundle.
 */
export async function ensureLocalDb() {
  if (overrideDb || !import.meta.env.DEV) return
  const { createSqliteDb } = await import('./local')
  overrideDb = createSqliteDb()
}

export function getDb(event?: Pick<RequestEvent, 'platform'> | null): DbInstance {
  // `vite dev` also hands us an (empty, unmigrated) emulated D1 binding; the migrated local SQLite file wins there.
  if (import.meta.env.DEV && overrideDb) return overrideDb

  const d1 = event?.platform?.env?.DB as any
  if (d1 && typeof d1.prepare === 'function') return drizzle(d1, { schema })
  if (overrideDb) return overrideDb
  throw new Error('No database available: missing D1 binding "DB" (production) or local DB not initialised (dev)')
}
