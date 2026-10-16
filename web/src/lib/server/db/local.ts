import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import * as schema from '@wordsvelte/shared'

// Node-only module: never imported in the Cloudflare bundle (see ensureLocalDb in ./index.ts).
const here = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(here, '..', '..', '..', '..', 'drizzle')
const DEFAULT_DB_PATH = join(here, '..', '..', '..', '..', '.local.db', 'portal.db')

export type LocalDb = BetterSQLite3Database<typeof schema>

export class LegacyDatabaseError extends Error {}

/** Open (and migrate) a SQLite database. Pass ':memory:' for tests; WORDSVELTE_LOCAL_DB overrides the dev default. */
export function createSqliteDb(path: string = process.env.WORDSVELTE_LOCAL_DB || DEFAULT_DB_PATH): LocalDb {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  // Databases created by the pre-migrator code have tables but no migration journal.
  const hasUsers = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get()
  const hasJournal = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'").get()
  if (hasUsers && !hasJournal) {
    sqlite.close()
    throw new LegacyDatabaseError(
      `Legacy local database at ${path} was created before versioned migrations. ` +
      'Delete the .local.db directory (or back it up) and restart to recreate it.',
    )
  }

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: MIGRATIONS_DIR })
  return db
}
