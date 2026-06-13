import { drizzle } from 'drizzle-orm/d1'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '@kubus/shared/src/db-schema'
import type { RequestEvent } from '@sveltejs/kit'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

type DbInstance = DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema>

let localDb: BetterSQLite3Database<typeof schema> | null = null

function initLocalDb(): BetterSQLite3Database<typeof schema> {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const dbDir = join(__dirname, '..', '..', '..', '.local.db')
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

  const dbPath = join(dbDir, 'portal.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  // Apply schema if tables don't exist
  const tableCount = sqlite.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users'").get() as { 'count(*)': number }
  if (tableCount['count(*)'] === 0) {
    const schemaPath = join(__dirname, '..', '..', '..', '..', 'schema.sql')
    if (existsSync(schemaPath)) {
      const sql = readFileSync(schemaPath, 'utf-8')
      // Remove comment lines and split into statements
      const cleaned = sql.replace(/^\s*--.*$/gm, '').trim()
      sqlite.exec(cleaned)
    }
  }

  // Seed admin if not exists
  const adminExists = sqlite.prepare("SELECT id FROM users WHERE email = ?").get('admin@kubus.id')
  if (!adminExists) {
    sqlite.prepare(`
      INSERT INTO users (email, username, password_hash, display_name, role)
      VALUES ('admin@kubus.id', 'admin', '07bc706237efe27969d0112d741fc71e:4ec4a3fdd5d6ce98694d480b98a270e0a2bc11e6cb5bc97ee5daa79c504c5f4e', 'Admin', 'admin')
    `).run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', 'Kubus News')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('site_description', 'Portal Berita Terkini')").run()
  }

  return drizzleSqlite(sqlite, { schema })
}

export function getDb(event?: RequestEvent): DbInstance {
  // Detect Cloudflare Workers: process.versions.node is undefined in CF Workers
  const isCfWorker = typeof process === 'undefined' || !process.versions?.node

  if (isCfWorker) {
    // In Cloudflare Workers/D1, platform.env.DB has a .prepare() method
    const d1 = event?.platform?.env?.DB as any
    if (d1 && typeof d1.prepare === 'function') {
      return drizzle(d1, { schema })
    }
  }

  // Local dev: use better-sqlite3
  if (!localDb) localDb = initLocalDb()
  return localDb
}
