import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import * as schema from '@wordsvelte/shared'
import type { RequestEvent } from '@sveltejs/kit'

/**
 * The query-builder type every service is written against. Production runs on D1 (async); local development and the tests
 * use better-sqlite3 (sync), which exposes the same builder API and is only ever awaited, so it is accepted here through
 * `setDb` / `asDb` rather than weakening the type for everyone.
 */
export type DbInstance = DrizzleD1Database<typeof schema>

/** Adapt a better-sqlite3 database (local dev, tests) to the D1-shaped type the services use. */
export const asDb = (db: unknown) => db as DbInstance

let overrideDb: DbInstance | null = null

/** Install a database used when no D1 binding is present (local dev and tests). */
export function setDb(db: unknown | null) {
  overrideDb = db === null ? null : asDb(db)
}

/**
 * Local dev only. `import.meta.env.DEV` is statically false in production builds,
 * so better-sqlite3/fs never reach the Cloudflare Worker bundle.
 */
export async function ensureLocalDb() {
  if (overrideDb || !import.meta.env.DEV) return
  const { createSqliteDb } = await import('./local')
  overrideDb = asDb(createSqliteDb())
}

export function getDb(event?: Pick<RequestEvent, 'platform'> | null): DbInstance {
  // `vite dev` also hands us an (empty, unmigrated) emulated D1 binding; the migrated local SQLite file wins there.
  if (import.meta.env.DEV && overrideDb) return overrideDb

  const d1 = event?.platform?.env?.DB as any
  if (d1 && typeof d1.prepare === 'function') return drizzle(d1, { schema })
  if (overrideDb) return overrideDb
  throw new Error('No database available: missing D1 binding "DB" (production) or local DB not initialised (dev)')
}
