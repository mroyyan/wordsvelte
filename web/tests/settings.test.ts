import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { settings } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { createToken } from '$lib/server/auth'
import { getSettings, updateSettings, isSecretKey } from '$lib/server/services/settings.service'
import { GET as getRoute, PUT as putRoute } from '../src/routes/api/settings/+server'
import { load as layoutLoad } from '../src/routes/+layout.server'
import { call, makeEvent, seedUser } from './helpers/harness'

const SECRET = 'super-secret-signing-key-do-not-leak'

async function plantSecrets() {
  const db = getDb()
  await db.insert(settings).values([
    { key: 'jwt_secret', value: SECRET },
    { key: 'admin_email', value: 'owner@example.com' },
    { key: 'smtp_password', value: 'hunter2' },
    { key: 'stripe_api_key', value: 'sk_live_123' },
    { key: 'webhook_token', value: 'tok_abc' },
  ])
}

describe('isSecretKey', () => {
  it.each(['jwt_secret', 'smtp_password', 'stripe_api_key', 'webhook_token', 'private_key', 'client_secret_v2'])('%s is secret', k => {
    expect(isSecretKey(k)).toBe(true)
  })
  it.each(['site_name', 'theme', 'posts_per_page', 'language'])('%s is not secret', k => {
    expect(isSecretKey(k)).toBe(false)
  })
})

describe('getSettings', () => {
  it('public scope hides secrets AND private keys', async () => {
    await plantSecrets()
    const s = await getSettings(getDb())
    expect(s.site_name).toBe('WordSvelte')
    for (const k of ['jwt_secret', 'admin_email', 'smtp_password', 'stripe_api_key', 'webhook_token']) expect(s).not.toHaveProperty(k)
    expect(JSON.stringify(s)).not.toContain(SECRET)
  })

  it('admin scope adds private keys but still never secrets', async () => {
    await plantSecrets()
    const s = await getSettings(getDb(), { scope: 'admin' })
    expect(s.admin_email).toBe('owner@example.com')
    for (const k of ['jwt_secret', 'smtp_password', 'stripe_api_key', 'webhook_token']) expect(s).not.toHaveProperty(k)
  })
})

describe('GET /api/settings', () => {
  it('anonymous callers never see secrets or private settings', async () => {
    await plantSecrets()
    const r = await call(getRoute, makeEvent())
    expect(r.status).toBe(200)
    expect(r.text).not.toContain(SECRET)
    expect(r.text).not.toContain('owner@example.com')
    expect(r.json.data.site_name).toBe('WordSvelte')
  })

  it('an invalid token is treated as anonymous (still public data only)', async () => {
    await plantSecrets()
    const r = await call(getRoute, makeEvent({ token: 'bogus' }))
    expect(r.status).toBe(200)
    expect(r.text).not.toContain('owner@example.com')
  })

  it('authors/editors get the public view; admins also get private keys; nobody gets secrets', async () => {
    await plantSecrets()
    const author = await seedUser('author')
    const admin = await seedUser('admin')
    expect((await call(getRoute, makeEvent({ token: author.token }))).text).not.toContain('owner@example.com')
    const adminView = await call(getRoute, makeEvent({ token: admin.token }))
    expect(adminView.json.data.admin_email).toBe('owner@example.com')
    expect(adminView.text).not.toContain(SECRET)
    expect(adminView.text).not.toContain('hunter2')
  })
})

describe('PUT /api/settings', () => {
  const put = (token: string | undefined, body: unknown) => call(putRoute, makeEvent({ method: 'PUT', body, token }))

  it('401 anonymous; 403 for author and editor', async () => {
    const author = await seedUser('author')
    const editor = await seedUser('editor')
    expect((await put(undefined, { site_name: 'x' })).status).toBe(401)
    expect((await put(author.token, { site_name: 'x' })).status).toBe(403)
    expect((await put(editor.token, { site_name: 'x' })).status).toBe(403)
    expect((await getSettings(getDb())).site_name).toBe('WordSvelte')
  })

  it('admin can update and upsert new keys', async () => {
    const admin = await seedUser('admin')
    expect((await put(admin.token, { site_name: 'My News', custom_flag: true, posts_per_page: 10 })).status).toBe(200)
    const s = await getSettings(getDb())
    expect(s).toMatchObject({ site_name: 'My News', custom_flag: 'true', posts_per_page: '10' })
  })

  it('cannot overwrite the JWT secret or any secret-like key (session forgery vector)', async () => {
    await plantSecrets()
    const admin = await seedUser('admin')
    for (const key of ['jwt_secret', 'smtp_password', 'api_key']) {
      const r = await put(admin.token, { [key]: 'attacker-chosen' })
      expect(r.status).toBe(400)
    }
    const [row] = await getDb().select().from(settings).where(eq(settings.key, 'jwt_secret'))
    expect(row.value).toBe(SECRET)
  })

  it('is all-or-nothing: one invalid entry means nothing is written', async () => {
    const admin = await seedUser('admin')
    const r = await put(admin.token, { site_name: 'Partially Applied', 'bad key!': 'x' })
    expect(r.status).toBe(400)
    expect((await getSettings(getDb())).site_name).toBe('WordSvelte')
  })

  it.each([
    ['invalid key characters', { 'Site Name': 'x' }],
    ['uppercase key', { SITE: 'x' }],
    ['object value', { site_name: { a: 1 } }],
    ['array value', { site_name: ['x'] }],
    ['null value', { site_name: null }],
    ['value too long', { site_name: 'x'.repeat(10_001) }],
  ])('rejects %s', async (_n, body) => {
    const admin = await seedUser('admin')
    expect((await put(admin.token, body)).status).toBe(400)
  })

  it('rejects an oversized batch and non-object bodies', async () => {
    const admin = await seedUser('admin')
    const big = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`k${i}`, 'v']))
    expect((await put(admin.token, big)).status).toBe(400)
    expect((await put(admin.token, '[1,2]')).status).toBe(400)
    expect((await put(admin.token, '{bad')).status).toBe(400)
  })

  it('updateSettings is idempotent', async () => {
    await updateSettings(getDb(), { site_name: 'A' })
    await updateSettings(getDb(), { site_name: 'B' })
    const rows = await getDb().select().from(settings).where(eq(settings.key, 'site_name'))
    expect(rows).toHaveLength(1)
    expect(rows[0].value).toBe('B')
  })
})

describe('regression: secrets must not leak through the page layout data', () => {
  it('+layout.server load (serialised into every page) contains no secret', async () => {
    // Force the dev fallback path to generate and persist the real jwt_secret.
    const { user } = await seedUser('admin')
    await createToken({ userId: user.id, role: 'admin' }, makeEvent({ platform: { env: {} } }))
    const [stored] = await getDb().select().from(settings).where(eq(settings.key, 'jwt_secret'))
    expect(stored.value).toMatch(/^[0-9a-f]{64}$/)
    await plantSecrets().catch(() => {}) // jwt_secret already exists: ignore the duplicate, add the rest below
    await getDb().insert(settings).values({ key: 'admin_email', value: 'owner@example.com' }).onConflictDoNothing()

    const data: any = await layoutLoad(makeEvent())
    const dump = JSON.stringify(data)
    expect(dump).not.toContain(stored.value)
    expect(dump).not.toContain('owner@example.com')
    expect(data.settings.site_name).toBe('WordSvelte')
    expect(data.menus.length).toBeGreaterThan(0)
    expect(data.widgets.length).toBe(4)
  })
})
