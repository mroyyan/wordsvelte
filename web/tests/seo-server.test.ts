import { describe, it, expect, vi } from 'vitest'
import { posts, pages, categories, tags, postCategories, postTags } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { updateSettings } from '$lib/server/services/settings.service'
import { xmlEscape, urlsetXml, sitemapIndexXml, newsSitemapXml, buildRobotsTxt, POSTS_PER_SITEMAP } from '$lib/server/sitemap'
import { cdata, rssXml } from '$lib/server/rss'
import { handle } from '../src/hooks.server'
import { GET as sitemapIndex } from '../src/routes/sitemap.xml/+server'
import { GET as sitemapPages } from '../src/routes/sitemap-pages.xml/+server'
import { GET as sitemapPosts } from '../src/routes/sitemap-posts-[page].xml/+server'
import { GET as sitemapNews } from '../src/routes/sitemap-news.xml/+server'
import { GET as robots } from '../src/routes/robots.txt/+server'
import { GET as rss } from '../src/routes/rss.xml/+server'
import { load as layoutLoad } from '../src/routes/+layout.server'
import { PUT as putSettings } from '../src/routes/api/settings/+server'
import { call, makeEvent, makeCookies, seedUser } from './helpers/harness'

const ORIGIN = 'http://localhost:5173'

async function author() { return (await seedUser('author')).user }
async function mkPost(authorId: number, over: Record<string, any> = {}) {
  const n = Math.random().toString(36).slice(2, 8)
  const [row] = await getDb().insert(posts).values({
    authorId, title: `Post ${n}`, slug: `post-${n}`, content: '<p>isi</p>', status: 'publish', publishedAt: '2026-10-01T10:00:00.000Z', ...over,
  }).returning()
  return row
}
const get = async (handler: any, opts: Parameters<typeof makeEvent>[0] = {}) => {
  const r = await call(handler, makeEvent({ path: '/', ...opts }))
  return r
}
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map(m => m[1])

describe('xml builders', () => {
  it('xmlEscape handles all five special characters', () => {
    expect(xmlEscape(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
    expect(xmlEscape(null)).toBe('')
  })

  it('urlset escapes URLs, omits empty optional fields, and drops control characters XML forbids', () => {
    const xml = urlsetXml([{ loc: 'https://x.test/a?b=1&c=2' }, { loc: 'https://x.test/\u0001ok', lastmod: '2026-10-05T00:00:00.000Z', changefreq: 'daily', priority: '0.5' }])
    expect(xml).toContain('<loc>https://x.test/a?b=1&amp;c=2</loc>')
    expect(xml).toContain('<loc>https://x.test/ok</loc>')
    expect(xml.match(/<lastmod>/g)).toHaveLength(1)
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(urlsetXml([])).toContain('<urlset')
  })

  it('news sitemap uses the required Google News elements with escaped titles', () => {
    const xml = newsSitemapXml([{ loc: 'https://x.test/a', title: 'Tom & Jerry <live>', publishedAt: '2026-10-05T09:00:00.000Z' }], { name: 'Kubus & Co', language: 'id' })
    expect(xml).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"')
    expect(xml).toContain('<news:name>Kubus &amp; Co</news:name>')
    expect(xml).toContain('<news:language>id</news:language>')
    expect(xml).toContain('<news:publication_date>2026-10-05T09:00:00.000Z</news:publication_date>')
    expect(xml).toContain('<news:title>Tom &amp; Jerry &lt;live&gt;</news:title>')
  })

  it('sitemap index lists children', () => {
    expect(locs(sitemapIndexXml([{ loc: 'https://x.test/a.xml' }, { loc: 'https://x.test/b.xml' }]))).toEqual(['https://x.test/a.xml', 'https://x.test/b.xml'])
  })

  it('robots.txt blocks the admin, API and search; a hidden site blocks everything and lists no sitemap', () => {
    const open = buildRobotsTxt('https://x.test', false)
    expect(open).toContain('Disallow: /admin')
    expect(open).toContain('Disallow: /api/')
    expect(open).toContain('Disallow: /search')
    expect(open).toContain('Sitemap: https://x.test/sitemap.xml')
    expect(open).toContain('Sitemap: https://x.test/sitemap-news.xml')
    expect(open).not.toMatch(/Disallow: \/\s*$/m)
    const hidden = buildRobotsTxt('https://x.test', true)
    expect(hidden).toBe('User-agent: *\nDisallow: /\n')
  })
})

describe('GET /sitemap.xml (index)', () => {
  it('always lists the pages and news sitemaps, plus one posts sitemap per 1,000 published posts', async () => {
    const u = await author()
    expect(locs((await get(sitemapIndex)).text)).toEqual([`${ORIGIN}/sitemap-pages.xml`, `${ORIGIN}/sitemap-news.xml`])
    await getDb().insert(posts).values(Array.from({ length: POSTS_PER_SITEMAP + 5 }, (_, i) => ({ authorId: u.id, title: `T${i}`, slug: `bulk-${i}`, content: 'x', status: 'publish' })))
    await getDb().insert(posts).values({ authorId: u.id, title: 'draft', slug: 'bulk-draft', content: 'x', status: 'draft' })
    const index = locs((await get(sitemapIndex)).text)
    expect(index).toContain(`${ORIGIN}/sitemap-posts-1.xml`)
    expect(index).toContain(`${ORIGIN}/sitemap-posts-2.xml`)
    expect(index).not.toContain(`${ORIGIN}/sitemap-posts-3.xml`)
  })

  it('is served as XML with a cache policy', async () => {
    const r = await get(sitemapIndex)
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('application/xml; charset=utf-8')
    expect(r.headers.get('Cache-Control')).toMatch(/s-maxage=\d+/)
  })
})

describe('GET /sitemap-pages.xml', () => {
  it('lists home, published pages, and only categories/tags that have published posts', async () => {
    const u = await author()
    await getDb().insert(pages).values([{ authorId: u.id, title: 'Tentang', slug: 'tentang', status: 'publish' }, { authorId: u.id, title: 'Rahasia', slug: 'rahasia', status: 'draft' }])
    const [full] = await getDb().insert(categories).values({ name: 'Nasional', slug: 'nasional' }).returning()
    const [empty] = await getDb().insert(categories).values({ name: 'Kosong', slug: 'kosong' }).returning()
    const [draftOnly] = await getDb().insert(categories).values({ name: 'Draf', slug: 'cuma-draf' }).returning()
    const [tag] = await getDb().insert(tags).values({ name: 'Politik', slug: 'politik' }).returning()
    const live = await mkPost(u.id)
    const draft = await mkPost(u.id, { status: 'draft' })
    await getDb().insert(postCategories).values([{ postId: live.id, categoryId: full.id }, { postId: draft.id, categoryId: draftOnly.id }])
    await getDb().insert(postTags).values({ postId: live.id, tagId: tag.id })
    void empty

    const urls = locs((await get(sitemapPages)).text)
    expect(urls).toEqual(expect.arrayContaining([`${ORIGIN}/`, `${ORIGIN}/tentang`, `${ORIGIN}/kategori/nasional`, `${ORIGIN}/tag/politik`]))
    for (const bad of ['rahasia', 'kategori/kosong', 'kategori/cuma-draf']) expect(urls).not.toContain(`${ORIGIN}/${bad}`)
  })
})

describe('GET /sitemap-posts-[page].xml', () => {
  it('lists published posts with ISO lastmod and never drafts', async () => {
    const u = await author()
    const a = await mkPost(u.id, { slug: 'berita-a', updatedAt: '2026-10-05 08:00:00' })
    await mkPost(u.id, { slug: 'berita-draf', status: 'draft' })
    const r = await get(sitemapPosts, { params: { page: '1' } })
    expect(locs(r.text)).toEqual([`${ORIGIN}/${a.slug}`])
    expect(r.text).toContain('<lastmod>2026-10-05T08:00:00.000Z</lastmod>')
  })

  it('an empty site still has a valid first chunk', async () => {
    const r = await get(sitemapPosts, { params: { page: '1' } })
    expect(r.status).toBe(200)
    expect(locs(r.text)).toEqual([])
  })

  it.each(['0', '-1', 'abc', '1.5', '', '999999999', '2', '3'])('chunk %j beyond the data (or malformed) is a 404', async page => {
    // SvelteKit's error() throws an HttpError instead of returning a Response
    await expect(Promise.resolve(sitemapPosts(makeEvent({ path: '/', params: { page } })))).rejects.toMatchObject({ status: 404 })
  })

  it('chunks are stable and non-overlapping', async () => {
    const u = await author()
    await getDb().insert(posts).values(Array.from({ length: POSTS_PER_SITEMAP + 3 }, (_, i) => ({ authorId: u.id, title: `T${i}`, slug: `s-${i}`, content: 'x', status: 'publish' })))
    const one = locs((await get(sitemapPosts, { params: { page: '1' } })).text)
    const two = locs((await get(sitemapPosts, { params: { page: '2' } })).text)
    expect(one).toHaveLength(POSTS_PER_SITEMAP)
    expect(two).toHaveLength(3)
    expect(new Set([...one, ...two]).size).toBe(POSTS_PER_SITEMAP + 3)
  })
})

describe('GET /sitemap-news.xml', () => {
  it('only lists articles from the last 48 hours, newest first', async () => {
    const u = await author()
    const now = Date.now()
    const iso = (hoursAgo: number) => new Date(now - hoursAgo * 3_600_000).toISOString()
    await mkPost(u.id, { slug: 'baru', title: 'Baru', publishedAt: iso(1) })
    await mkPost(u.id, { slug: 'kemarin', title: 'Kemarin', publishedAt: iso(30) })
    await mkPost(u.id, { slug: 'lama', title: 'Lama', publishedAt: iso(24 * 5) })
    await mkPost(u.id, { slug: 'draf-baru', title: 'Draf', status: 'draft', publishedAt: iso(1) })
    const sqliteFormat = new Date(now - 2 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')
    await mkPost(u.id, { slug: 'format-sqlite', title: 'Format SQLite', publishedAt: null, createdAt: sqliteFormat })
    const r = await get(sitemapNews)
    expect(locs(r.text)).toEqual([`${ORIGIN}/baru`, `${ORIGIN}/format-sqlite`, `${ORIGIN}/kemarin`])
    expect(r.text).toContain('<news:title>Baru</news:title>')
    expect(r.headers.get('Cache-Control')).toContain('s-maxage=600') // news ages quickly
  })

  it('excludes posts dated in the future', async () => {
    const u = await author()
    await mkPost(u.id, { slug: 'masa-depan', publishedAt: new Date(Date.now() + 3 * 86_400_000).toISOString() })
    expect(locs((await get(sitemapNews)).text)).toEqual([])
  })

  it('carries the site name and language from Settings', async () => {
    const u = await author()
    await mkPost(u.id, { publishedAt: new Date().toISOString() })
    await updateSettings(getDb(), { site_name: 'Kubus & Co', language: 'en' })
    const r = await get(sitemapNews)
    expect(r.text).toContain('<news:language>en</news:language>')
    expect(r.text).toContain('<news:name>Kubus &amp; Co</news:name>')
    expect(r.text).not.toContain('Kubus & Co')
  })
})

describe('Site URL', () => {
  it('uses the configured Site URL everywhere, even if the request came in on another address', async () => {
    const u = await author()
    const p = await mkPost(u.id, { slug: 'dari-konfigurasi' })
    await updateSettings(getDb(), { site_url: 'https://berita.example.com' })
    expect(locs((await get(sitemapPosts, { params: { page: '1' } })).text)).toEqual([`https://berita.example.com/${p.slug}`])
    expect(locs((await get(sitemapIndex)).text).every(l => l.startsWith('https://berita.example.com/'))).toBe(true)
    expect((await get(robots)).text).toContain('Sitemap: https://berita.example.com/sitemap.xml')
    expect((await get(rss)).text).toContain(`<link>https://berita.example.com/${p.slug}</link>`)
  })

  it('falls back to the address of the request when none is configured (never a hard-coded domain)', async () => {
    const r = await call(robots, makeEvent({ path: '/robots.txt', origin: 'https://detected.example.org' }))
    expect(r.text).toContain('Sitemap: https://detected.example.org/sitemap.xml')
    expect(r.text).not.toContain('wordsvelte.id')
  })

  it('the page layout hands the canonical origin to every page', async () => {
    expect((await layoutLoad(makeEvent({ path: '/' })) as any).siteUrl).toBe(ORIGIN)
    await updateSettings(getDb(), { site_url: 'https://berita.example.com' })
    expect((await layoutLoad(makeEvent({ path: '/' })) as any).siteUrl).toBe('https://berita.example.com')
  })

  it.each(['https://news.example.com', 'http://localhost:5173', 'https://news.example.com/', ''])('Settings accepts %j', async value => {
    const admin = await seedUser('admin')
    expect((await call(putSettings, makeEvent({ method: 'PUT', token: admin.token, body: { site_url: value } }))).status).toBe(200)
  })

  it.each(['news.example.com', 'javascript:alert(1)', 'ftp://news.example.com', 'https://news.example.com/blog', 'https://news.example.com/?x=1', 'https://news.example.com/#top', 'https://'])('Settings rejects %j', async value => {
    const admin = await seedUser('admin')
    const r = await call(putSettings, makeEvent({ method: 'PUT', token: admin.token, body: { site_url: value } }))
    expect(r.status).toBe(400)
    expect(r.json.error).toMatch(/site_url/)
  })
})

describe('"Allow search engines" off', () => {
  it('robots.txt disallows everything and the sitemaps advertise nothing', async () => {
    const u = await author()
    await mkPost(u.id)
    await updateSettings(getDb(), { search_engine_visible: 'false' })
    expect((await get(robots)).text).toBe('User-agent: *\nDisallow: /\n')
    expect(locs((await get(sitemapIndex)).text)).toEqual([])
    expect(locs((await get(sitemapPages)).text)).toEqual([])
    expect(locs((await get(sitemapPosts, { params: { page: '1' } })).text)).toEqual([])
    expect(locs((await get(sitemapNews)).text)).toEqual([])
    expect(locs((await get(rss)).text)).toEqual([]) // no <loc> in RSS; also check items below
    expect((await get(rss)).text).not.toContain('<item>')
  })
})

describe('RSS feed', () => {
  it('escapes the site name and survives a title containing "]]>"', async () => {
    const u = await author()
    await updateSettings(getDb(), { site_name: 'Kubus & <Co>' })
    await mkPost(u.id, { title: 'Bahaya ]]> di judul', slug: 'bahaya' })
    const xml = (await get(rss)).text
    expect(xml).toContain('<title><![CDATA[Kubus & <Co>]]></title>')
    expect(xml).toContain('<title><![CDATA[Bahaya ]]]]><![CDATA[> di judul]]></title>')
    expect(cdata('a]]>b')).toBe('<![CDATA[a]]]]><![CDATA[>b]]>')
  })

  it('lists published posts newest first with absolute links, RFC 822 dates, categories and the author', async () => {
    const u = await author()
    const [cat] = await getDb().insert(categories).values({ name: 'Nasional', slug: 'nasional' }).returning()
    const older = await mkPost(u.id, { slug: 'lebih-lama', title: 'Lebih lama', publishedAt: '2026-10-01T10:00:00.000Z' })
    const newer = await mkPost(u.id, { slug: 'lebih-baru', title: 'Lebih baru', publishedAt: null, createdAt: '2026-10-09 06:30:00' })
    await mkPost(u.id, { slug: 'draf-rss', status: 'draft' })
    await getDb().insert(postCategories).values({ postId: newer.id, categoryId: cat.id })
    const xml = (await get(rss)).text
    expect(locs(xml)).toEqual([]) // <link> elements, not <loc>
    const links = [...xml.matchAll(/<item>[\s\S]*?<link>([^<]*)<\/link>/g)].map(m => m[1])
    expect(links).toEqual([`${ORIGIN}/${newer.slug}`, `${ORIGIN}/${older.slug}`])
    expect(xml).toContain('<pubDate>Fri, 09 Oct 2026 06:30:00 GMT</pubDate>')
    expect(xml).toContain('<category><![CDATA[Nasional]]></category>')
    expect(xml).toContain(`<dc:creator><![CDATA[${u.displayName}]]></dc:creator>`)
    expect(xml).toContain(`<atom:link href="${ORIGIN}/rss.xml" rel="self" type="application/rss+xml" />`)
    expect(xml).not.toContain('draf-rss')
  })

  it('sanitises full content and builds a plain-text description', async () => {
    const u = await author()
    await mkPost(u.id, { slug: 'xss', content: '<p>Halo <b>dunia</b></p><script>alert(1)</script><img src=x onerror=alert(2)>', excerpt: null })
    const xml = (await get(rss)).text
    expect(xml).not.toMatch(/<script|onerror/i)
    expect(xml).toContain('<description><![CDATA[Halo dunia]]></description>')
    expect(xml).toContain('<content:encoded>')
  })

  it('is served as RSS with a cache policy and valid structure for an empty site', async () => {
    const r = await get(rss)
    expect(r.headers.get('Content-Type')).toBe('application/rss+xml; charset=utf-8')
    expect(r.headers.get('Cache-Control')).toMatch(/s-maxage/)
    expect(r.text).toMatch(/<rss version="2.0"[\s\S]*<channel>[\s\S]*<\/channel>\s*<\/rss>/)
  })

  it('rssXml with no dated items still produces a lastBuildDate', () => {
    expect(rssXml({ name: 'X', description: '', origin: 'https://x.test', language: 'id' }, [], new Date('2026-10-05T00:00:00Z'))).toContain('<lastBuildDate>Mon, 05 Oct 2026 00:00:00 GMT</lastBuildDate>')
  })
})

describe('X-Robots-Tag on private areas (hooks)', () => {
  function run(path: string) {
    const url = new URL(`https://news.example.com${path}`)
    const event: any = { url, request: new Request(url), cookies: makeCookies() }
    return (handle as any)({ event, resolve: vi.fn(async () => new Response('ok')) }) as Promise<Response>
  }

  it.each(['/admin', '/admin/posts', '/admin/login', '/api/posts', '/api/auth/me'])('%s is marked noindex', async p => {
    expect((await run(p)).headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
  })

  it.each(['/', '/berita-satu', '/kategori/nasional', '/administrasi', '/apiary', '/rss.xml', '/sitemap.xml'])('%s is left indexable', async p => {
    expect((await run(p)).headers.get('X-Robots-Tag')).toBeNull()
  })
})
