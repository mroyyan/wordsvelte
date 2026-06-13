import { drizzle } from 'drizzle-orm/d1'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
import * as schema from '@wordsvelte/shared'
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
  const dbDir = join(__dirname, '..', '..', '..', '..', '.local.db')
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

  const dbPath = join(dbDir, 'portal.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  // Apply schema if tables don't exist
  const tableCount = sqlite.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users'").get() as { 'count(*)': number }
  if (tableCount['count(*)'] === 0) {
    const schemaPath = join(__dirname, '..', '..', '..', '..', 'drizzle', '0000_far_pandemic.sql')
    if (existsSync(schemaPath)) {
      const sql = readFileSync(schemaPath, 'utf-8')
      const cleaned = sql.replace(/^\s*--.*$/gm, '').trim()
      sqlite.exec(cleaned)
    }
  }

  // Apply migrations for new tables if missing
  const widgetsExist = sqlite.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='widgets'").get() as { 'count(*)': number }
  if (widgetsExist['count(*)'] === 0) {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS widgets (id INTEGER PRIMARY KEY AUTOINCREMENT, widget_type TEXT NOT NULL, title TEXT, content TEXT, settings TEXT, sidebar_area TEXT NOT NULL DEFAULT 'sidebar-1', sort_order INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS menus (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, location TEXT NOT NULL DEFAULT 'header', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS menu_items (id INTEGER PRIMARY KEY AUTOINCREMENT, menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE, parent_id INTEGER REFERENCES menu_items(id), item_type TEXT NOT NULL DEFAULT 'custom', label TEXT NOT NULL, url TEXT, target TEXT NOT NULL DEFAULT '_self', sort_order INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT (datetime('now')));
    `)
  }

  // Seed default widgets if none exist
  const widgetCount = sqlite.prepare("SELECT count(*) FROM widgets").get() as { 'count(*)': number }
  if (widgetCount['count(*)'] === 0) {
    sqlite.prepare("INSERT OR IGNORE INTO widgets (widget_type, title, sidebar_area, sort_order, status) VALUES ('popular_posts', 'Berita Populer', 'sidebar-1', 1, 'active')").run()
    sqlite.prepare("INSERT OR IGNORE INTO widgets (widget_type, title, sidebar_area, sort_order, status) VALUES ('recent_posts', 'Berita Terbaru', 'sidebar-1', 2, 'active')").run()
    sqlite.prepare("INSERT OR IGNORE INTO widgets (widget_type, title, sidebar_area, sort_order, status) VALUES ('categories', 'Kategori', 'sidebar-1', 3, 'active')").run()
    sqlite.prepare("INSERT OR IGNORE INTO widgets (widget_type, title, sidebar_area, sort_order, status) VALUES ('tag_cloud', 'Tag', 'sidebar-1', 4, 'active')").run()
  }

  // Seed default menu if none exist
  const menuCount = sqlite.prepare("SELECT count(*) FROM menus").get() as { 'count(*)': number }
  if (menuCount['count(*)'] === 0) {
    sqlite.prepare("INSERT INTO menus (name, slug, location, status) VALUES ('Main Menu', 'main-menu', 'header', 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Beranda', '/', 1, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Regional', '#', 2, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 2, 'custom', 'Kediri Raya', '/kategori/kediri-raya', 1, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 2, 'custom', 'Jawa Timur', '/kategori/jawa-timur', 2, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Nasional', '/kategori/nasional', 3, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Dunia', '/kategori/dunia', 4, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Olah Raga', '/kategori/olahraga', 5, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Gaya Hidup', '/kategori/gaya-hidup', 6, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Religi', '/kategori/religi', 7, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, item_type, label, url, sort_order, status) VALUES (1, 'custom', 'Lainnya', '#', 8, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 10, 'custom', 'Event', '/kategori/event', 1, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 10, 'custom', 'Hiburan', '/kategori/hiburan', 2, 'active')").run()
    sqlite.prepare("INSERT INTO menu_items (menu_id, parent_id, item_type, label, url, sort_order, status) VALUES (1, 10, 'custom', 'Opini', '/kategori/opini', 3, 'active')").run()
  }

  // Seed default settings if not exist
  const siteNameExists = sqlite.prepare("SELECT count(*) FROM settings WHERE key = 'site_name'").get() as { 'count(*)': number }
  if (siteNameExists['count(*)'] === 0) {
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', 'Kubus News')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('site_description', 'Portal Berita Terkini')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_email', 'admin@kubus.id')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('timezone', 'Asia/Jakarta')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('date_format', 'd F Y')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('language', 'id')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('posts_per_page', '20')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('search_engine_visible', 'true')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('comments_enabled', 'true')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('comments_auto_approve', 'false')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('comments_require_name_email', 'true')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('comments_close_after_days', '30')").run()
    sqlite.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('media_organize_by_month', 'true')").run()
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
