import { describe, it, expect } from 'vitest'
import { posts } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { getSettings, updateSettings, SETTING_RULES } from '$lib/server/services/settings.service'
import { createComment } from '$lib/server/services/comment.service'
import { ValidationError, ForbiddenError } from '$lib/server/errors'
import { PUT as putSettings } from '../src/routes/api/settings/+server'
import { call, makeEvent, seedUser } from './helpers/harness'

const save = (patch: Record<string, unknown>) => updateSettings(getDb(), patch)

describe('setting values are validated per key', () => {
  it.each([
    ['timezone', 'Asia/Jakarta'], ['timezone', 'UTC'], ['language', 'id'], ['language', 'en'],
    ['date_format', 'd F Y'], ['date_format', 'l, d F Y'], ['posts_per_page', '1'], ['posts_per_page', '100'],
    ['comments_close_after_days', '0'], ['comments_close_after_days', '3650'], ['sticky_sidebar', 'true'], ['comments_enabled', 'false'],
    ['admin_email', ''], ['admin_email', 'owner@example.com'], ['social_facebook', ''], ['social_facebook', 'https://facebook.com/news'],
    ['default_og_image', ''], ['default_og_image', '/api/media/2026/01/x.png'], ['default_og_image', 'https://cdn.example.com/og.jpg'],
    ['site_name', 'My News'], ['footer_copyright_text', ''],
  ])('accepts %s = %j', async (key, value) => {
    await expect(save({ [key]: value })).resolves.toBeUndefined()
    expect((await getSettings(getDb(), { scope: 'admin' }))[key]).toBe(value)
  })

  it.each([
    ['timezone', 'Mars/Olympus'], ['timezone', ''], ['timezone', 'asia jakarta'],
    ['language', 'fr'], ['language', ''],
    ['date_format', '<script>'], ['date_format', ''], ['date_format', 'd F Y; DROP TABLE'],
    ['posts_per_page', ''], ['posts_per_page', '0'], ['posts_per_page', '101'], ['posts_per_page', '-5'], ['posts_per_page', '2.5'], ['posts_per_page', 'abc'], ['posts_per_page', '1e3'],
    ['comments_close_after_days', '-1'], ['comments_close_after_days', '3651'], ['comments_close_after_days', ''],
    ['sticky_sidebar', 'yes'], ['comments_enabled', '1'], ['search_engine_visible', ''], ['comments_auto_approve', 'TRUE'],
    ['admin_email', 'not-an-email'], ['social_twitter', 'javascript:alert(1)'], ['social_youtube', 'facebook.com/x'], ['social_instagram', 'ftp://x.test'],
    ['default_og_image', 'javascript:alert(1)'], ['default_og_image', '//evil.example/x.png'.replace('//', 'x')],
    ['site_name', ''], ['site_name', '   '], ['site_name', 'x'.repeat(101)],
    ['footer_copyright_text', 'x'.repeat(201)], ['default_meta_description', 'x'.repeat(301)],
  ])('rejects %s = %j with a 400-class error and writes nothing', async (key, value) => {
    const before = await getSettings(getDb(), { scope: 'admin' })
    await expect(save({ [key]: value })).rejects.toBeInstanceOf(ValidationError)
    expect(await getSettings(getDb(), { scope: 'admin' })).toEqual(before)
  })

  it('error messages name the setting and the problem', async () => {
    await expect(save({ posts_per_page: '0' })).rejects.toThrow(/posts_per_page.*between 1 and 100/)
    await expect(save({ timezone: 'Nope/Zone' })).rejects.toThrow(/timezone.*valid timezone/)
  })

  it('one bad value rejects the whole batch (no half-saved settings)', async () => {
    await expect(save({ site_name: 'Changed', posts_per_page: 'abc' })).rejects.toBeInstanceOf(ValidationError)
    expect((await getSettings(getDb())).site_name).toBe('WordSvelte')
  })

  it('keys without a rule (e.g. theme) are still accepted', async () => {
    await expect(save({ theme: 'default', my_custom_flag: 'x' })).resolves.toBeUndefined()
  })

  it('the shipped defaults all satisfy their own rules (a fresh install can be saved untouched)', async () => {
    const defaults = await getSettings(getDb(), { scope: 'admin' })
    for (const [key, value] of Object.entries(defaults)) {
      const rule = SETTING_RULES[key]
      if (rule) expect(rule(value), `${key} = ${JSON.stringify(value)}`).toBeNull()
    }
    await expect(save(defaults)).resolves.toBeUndefined()
  })

  it('PUT /api/settings answers 400 with the reason, so the admin screen can show it', async () => {
    const admin = await seedUser('admin')
    const r = await call(putSettings, makeEvent({ method: 'PUT', token: admin.token, body: { posts_per_page: '' } }))
    expect(r.status).toBe(400)
    expect(r.json.error).toMatch(/posts_per_page/)
    expect((await call(putSettings, makeEvent({ method: 'PUT', token: admin.token, body: { posts_per_page: '12', language: 'en' } }))).status).toBe(200)
  })
})

describe('comments_require_name_email is honoured', () => {
  async function publishedPost() {
    const { user } = await seedUser('author')
    const [p] = await getDb().insert(posts).values({ authorId: user.id, title: 'T', slug: 't', content: 'x', status: 'publish', publishedAt: new Date().toISOString() }).returning()
    return p
  }

  it('required by default: both name and a valid email', async () => {
    const p = await publishedPost()
    await expect(createComment(getDb(), { postId: p.id, authorName: '', authorEmail: 'a@b.co', content: 'hi' })).rejects.toBeInstanceOf(ValidationError)
    await expect(createComment(getDb(), { postId: p.id, authorName: 'Ann', authorEmail: '', content: 'hi' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('when switched off, name and email may be omitted', async () => {
    const p = await publishedPost()
    await save({ comments_require_name_email: 'false' })
    const c = await createComment(getDb(), { postId: p.id, authorName: '', authorEmail: '', content: 'anonymous words' })
    expect(c).toMatchObject({ authorName: 'Anonim', content: 'anonymous words' })
    expect(c).not.toHaveProperty('authorEmail')
    const named = await createComment(getDb(), { postId: p.id, authorName: 'Budi', authorEmail: '', content: 'hello' })
    expect(named.authorName).toBe('Budi')
  })

  it('but an email that IS given must still be valid, and empty content is still refused', async () => {
    const p = await publishedPost()
    await save({ comments_require_name_email: 'false' })
    await expect(createComment(getDb(), { postId: p.id, authorName: 'X', authorEmail: 'not-an-email', content: 'hi' })).rejects.toBeInstanceOf(ValidationError)
    await expect(createComment(getDb(), { postId: p.id, authorName: '', authorEmail: '', content: '  ' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('closing comments after N days understands every stored date format', async () => {
    const { user } = await seedUser('author')
    const old = new Date(Date.now() - 40 * 86_400_000)
    const sqlite = old.toISOString().slice(0, 19).replace('T', ' ') // "YYYY-MM-DD HH:MM:SS", the column default format
    const [p] = await getDb().insert(posts).values({ authorId: user.id, title: 'Old', slug: 'old', content: 'x', status: 'publish', publishedAt: null, createdAt: sqlite }).returning()
    await save({ comments_close_after_days: '30' })
    await expect(createComment(getDb(), { postId: p.id, authorName: 'A', authorEmail: 'a@b.co', content: 'late' })).rejects.toBeInstanceOf(ForbiddenError)
  })
})
