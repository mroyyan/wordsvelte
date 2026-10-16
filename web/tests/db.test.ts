import { describe, it, expect, afterAll, vi } from 'vitest'
import { mkdtempSync, rmSync, readdirSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { getDb, setDb } from '$lib/server/db'
import { createSqliteDb, LegacyDatabaseError } from '$lib/server/db/local'
import { users, posts, settings } from '@wordsvelte/shared'

const dirs: string[] = []
afterAll(() => dirs.forEach(d => rmSync(d, { recursive: true, force: true })))
const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'ws-db-')); dirs.push(d); return d }

describe('getDb', () => {
  it('production: uses the D1 binding from the platform', () => {
    vi.stubEnv('DEV', false)
    const fakeD1 = { prepare: () => ({}), batch: async () => [], exec: async () => ({}) }
    const db = getDb({ platform: { env: { DB: fakeD1 } } } as any)
    expect(db).not.toBe(getDb())
    expect(typeof (db as any).select).toBe('function')
    vi.unstubAllEnvs()
  })

  it('dev: the migrated local SQLite wins over the emulated (empty) D1 binding', () => {
    const fakeD1 = { prepare: () => ({}), batch: async () => [], exec: async () => ({}) }
    expect(getDb({ platform: { env: { DB: fakeD1 } } } as any)).toBe(getDb())
  })

  it('falls back to the installed local/test database', () => {
    expect(getDb({ platform: { env: {} } } as any)).toBe(getDb())
  })

  it('throws a descriptive error instead of silently using nothing', () => {
    setDb(null)
    expect(() => getDb()).toThrow(/No database available/)
  })
})

describe('createSqliteDb / migrations', () => {
  it('creates the full schema with foreign keys enforced', async () => {
    const db = createSqliteDb(':memory:')
    await expect(db.insert(posts).values({ authorId: 4242, title: 't', slug: 's', content: 'c' })).rejects.toThrow(/FOREIGN KEY/i)
  })

  it('persists to a file and re-opening is idempotent (migrations run once, seed rows not duplicated)', async () => {
    const path = join(tmp(), 'nested', 'dir', 'app.db')
    const first = createSqliteDb(path)
    const before = (await first.select().from(settings)).length
    ;(first as any).$client.close()

    const second = createSqliteDb(path)
    expect((await second.select().from(settings)).length).toBe(before)
    ;(second as any).$client.close()
  })

  it('refuses a legacy (pre-migration-journal) database with an actionable message instead of corrupting it', () => {
    const path = join(tmp(), 'legacy.db')
    const raw = new Database(path)
    raw.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)')
    raw.close()
    expect(() => createSqliteDb(path)).toThrow(LegacyDatabaseError)
    expect(() => createSqliteDb(path)).toThrow(/Delete the \.local\.db directory/)
  })

  it('every migration file is registered in the journal and the first one is the schema', () => {
    const dir = join(__dirname, '../drizzle')
    const sqlFiles = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
    const journal = JSON.parse(readFileSync(join(dir, 'meta/_journal.json'), 'utf8'))
    expect(journal.entries.map((e: any) => `${e.tag}.sql`)).toEqual(sqlFiles)
    expect(sqlFiles[0]).toMatch(/^0000_/)
    expect(sqlFiles).toContain('0001_seed_defaults.sql')
  })

  it('the schema is in sync with drizzle migrations (including is_featured)', () => {
    const db = createSqliteDb(':memory:')
    const raw = (db as any).$client as Database.Database
    const cols = raw.prepare("PRAGMA table_info('posts')").all().map((c: any) => c.name)
    expect(cols).toContain('is_featured')
    const idx = raw.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r: any) => r.name)
    expect(idx).toEqual(expect.arrayContaining(['idx_posts_status_published', 'idx_comments_post_status', 'users_email_unique', 'posts_slug_unique']))
  })

  it('uses real SQL defaults for timestamps in the generated migration (no quoted function text)', () => {
    const sql = readFileSync(join(__dirname, '../drizzle', readdirSync(join(__dirname, '../drizzle')).find(f => f.startsWith('0000_'))!), 'utf8')
    expect(sql).toContain("DEFAULT (datetime('now'))")
    expect(sql).not.toContain("'datetime(''now'')'")
  })

  it('users table enforces unique email and username at the DB level', async () => {
    const db = createSqliteDb(':memory:')
    const row = { email: 'a@b.co', username: 'abc', passwordHash: 'x:y', displayName: 'A' }
    await db.insert(users).values(row)
    await expect(db.insert(users).values({ ...row, username: 'other' })).rejects.toThrow(/UNIQUE/i)
    await expect(db.insert(users).values({ ...row, email: 'c@d.co' })).rejects.toThrow(/UNIQUE/i)
  })
})
