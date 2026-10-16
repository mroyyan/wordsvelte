import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDb } from '$lib/server/db'
import { posts, media, categories, tags, comments } from '@wordsvelte/shared'
import { runImport, getPreview, isFetchableImageUrl } from '$lib/server/services/migrate.service'
import { POST as previewRoute } from '../src/routes/api/migrate/preview/+server'
import { POST as importRoute } from '../src/routes/api/migrate/import/+server'
import { call, makeEvent, seedUser, fakeR2, withR2, PNG_BYTES } from './helpers/harness'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

const wxr = (body: string) => `<?xml version="1.0"?><rss xmlns:wp="w" xmlns:content="c" xmlns:excerpt="e"><channel>${body}</channel></rss>`
const SAMPLE = wxr(`
  <item><title>Photo</title><wp:post_type>attachment</wp:post_type><wp:post_id>10</wp:post_id><wp:attachment_url>https://blog.example.com/wp-content/a.png</wp:attachment_url></item>
  <item>
    <title>Imported Post</title><wp:post_type>post</wp:post_type><wp:post_id>1</wp:post_id><wp:post_name>imported-post</wp:post_name>
    <wp:status>publish</wp:status><wp:post_date>2023-05-01 10:00:00</wp:post_date>
    <content:encoded><![CDATA[<p onclick="x()">Hi</p><script>alert(1)</script><img src="https://blog.example.com/wp-content/a.png"><img src="https://blog.example.com/fake.png"><img src="http://169.254.169.254/latest/meta-data"><img src="http://localhost:8080/admin.png">]]></content:encoded>
    <excerpt:encoded><![CDATA[short]]></excerpt:encoded>
    <category domain="category" nicename="news"><![CDATA[News]]></category>
    <category domain="post_tag" nicename="hot"><![CDATA[Hot]]></category>
    <wp:postmeta><wp:meta_key>_thumbnail_id</wp:meta_key><wp:meta_value>10</wp:meta_value></wp:postmeta>
    <wp:comment><wp:comment_id>5</wp:comment_id><wp:comment_author>Ann</wp:comment_author><wp:comment_author_email>ann@example.com</wp:comment_author_email><wp:comment_content>Nice</wp:comment_content><wp:comment_approved>1</wp:comment_approved><wp:comment_date>2023-05-02 10:00:00</wp:comment_date></wp:comment>
  </item>
  <item><title>Draft one</title><wp:post_type>post</wp:post_type><wp:post_id>2</wp:post_id><wp:post_name>draft-one</wp:post_name><wp:status>draft</wp:status><content:encoded><![CDATA[<p>d</p>]]></content:encoded></item>
`)

describe('isFetchableImageUrl (SSRF guard for untrusted XML)', () => {
  it.each([
    'https://blog.example.com/a.png', 'http://cdn.example.org/x/y.jpg', 'https://8.8.8.8/a.png',
  ])('allows public %s', u => expect(isFetchableImageUrl(u)).toBe(true))

  it.each([
    'http://localhost/a.png', 'http://LOCALHOST:3000/a.png', 'http://127.0.0.1/a.png', 'http://10.0.0.5/a.png',
    'http://192.168.1.1/a.png', 'http://172.16.0.1/a.png', 'http://172.31.255.1/a.png', 'http://169.254.169.254/latest/meta-data',
    'http://0.0.0.0/a.png', 'http://[::1]/a.png', 'http://printer.local/a.png', 'http://db.internal/a.png',
    'file:///etc/passwd', 'ftp://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'not a url', '',
  ])('blocks %s', u => expect(isFetchableImageUrl(u)).toBe(false))
})

describe('getPreview', () => {
  it('counts posts, categories, tags, images and comments', () => {
    expect(getPreview(SAMPLE)).toMatchObject({ posts: 2, categories: 1, tags: 1, comments: 1 })
  })
  it('handles an empty export', () => {
    expect(getPreview(wxr(''))).toMatchObject({ posts: 0, categories: 0, tags: 0, comments: 0 })
  })
})

describe('runImport', () => {
  function mockFetch() {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url))
      if (String(url).endsWith('a.png')) return new Response(PNG_BYTES, { headers: { 'content-type': 'text/html' } }) // lying header
      if (String(url).endsWith('fake.png')) return new Response('<html><script>alert(1)</script></html>', { headers: { 'content-type': 'image/png' } }) // lying content
      return new Response('nope', { status: 404 })
    }))
    return calls
  }

  it('imports content, only keeps real images, never contacts internal hosts, and sanitises HTML', async () => {
    const calls = mockFetch()
    const { user } = await seedUser('admin')
    const r2 = fakeR2()
    const progress: any[] = []
    await runImport(SAMPLE, getDb(), r2, user.id, p => progress.push(p))

    expect(progress.at(-1).stage).toBe('done')
    expect(await getDb().select().from(categories)).toHaveLength(1)
    expect(await getDb().select().from(tags)).toHaveLength(1)
    const imported = await getDb().select().from(posts)
    expect(imported.map((p: any) => p.slug).sort()).toEqual(['draft-one', 'imported-post'])
    const post = imported.find((p: any) => p.slug === 'imported-post')!
    expect(post.status).toBe('publish')
    expect(post.content).not.toMatch(/<script|onclick/i)
    expect(imported.find((p: any) => p.slug === 'draft-one')!.status).toBe('draft')
    expect(await getDb().select().from(comments)).toHaveLength(1)

    // SSRF: internal URLs found in the XML are never fetched
    expect(calls.some(u => /169\.254|localhost/.test(u))).toBe(false)
    // only the real PNG is stored; the HTML-pretending-to-be-image is dropped
    const stored = await getDb().select().from(media)
    expect(stored).toHaveLength(1)
    expect(stored[0].mimeType).toBe('image/png') // sniffed, not the lying text/html header
    expect(stored[0].r2Key).toMatch(/\.png$/)
    expect([...r2.store.values()].every(o => o.httpMetadata.contentType === 'image/png')).toBe(true)
    expect(post.featuredImageUrl).toMatch(/^\/api\/media\/\d{4}\/\d{2}\/.+\.png$/)
  })

  it('is safe to run twice: slugs get unique suffixes instead of crashing', async () => {
    mockFetch()
    const { user } = await seedUser('admin')
    await runImport(SAMPLE, getDb(), fakeR2(), user.id, () => {})
    await runImport(SAMPLE, getDb(), fakeR2(), user.id, () => {})
    const slugs = (await getDb().select().from(posts)).map((p: any) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(slugs).toHaveLength(4)
  })
})

describe('migrate API', () => {
  const form = (content: string, name: string) => { const fd = new FormData(); fd.set('file', new File([content], name)); return fd }

  it('preview: admin-only, validates extension', async () => {
    const author = await seedUser('author')
    const admin = await seedUser('admin')
    const go = (token: string | undefined, fd: FormData) => call(previewRoute, makeEvent({ method: 'POST', formData: fd, token }))
    expect((await go(undefined, form(SAMPLE, 'x.xml'))).status).toBe(401)
    expect((await go(author.token, form(SAMPLE, 'x.xml'))).status).toBe(403)
    expect((await go(admin.token, form(SAMPLE, 'x.exe'))).status).toBe(400)
    expect((await go(admin.token, new FormData())).status).toBe(400)
    const ok = await go(admin.token, form(SAMPLE, 'export.xml'))
    expect(ok.status).toBe(200)
    expect(ok.json.data.posts).toBe(2)
  })

  it('import: admin-only (it used to be open to every signed-in user), validates file and R2', async () => {
    const author = await seedUser('author')
    const admin = await seedUser('admin')
    const go = (token: string | undefined, fd: FormData, platform = withR2()) => call(importRoute, makeEvent({ method: 'POST', formData: fd, token, platform }))
    expect((await go(undefined, form(SAMPLE, 'x.xml'))).status).toBe(401)
    expect((await go(author.token, form(SAMPLE, 'x.xml'))).status).toBe(403)
    expect((await go(admin.token, form(SAMPLE, 'x.html'))).status).toBe(400)
    expect((await go(admin.token, new FormData())).status).toBe(400)
    expect((await go(admin.token, form(SAMPLE, 'x.xml'), { env: { JWT_SECRET: 'test-secret-that-is-long-enough-123456' } } as any)).status).toBe(503)
  })

  it('import: streams SSE progress ending in a done event', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 404 })))
    const admin = await seedUser('admin')
    const r = await call(importRoute, makeEvent({ method: 'POST', formData: form(SAMPLE, 'x.xml'), token: admin.token, platform: withR2() }))
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('text/event-stream')
    const events = r.text.split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')))
    expect(events.at(-1).stage).toBe('done')
  })
})
