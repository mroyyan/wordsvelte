import { describe, it, expect, vi, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { pages, posts, menuItems, toSlug } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { createPage, updatePage, deletePage, listPages, getPageById, getPublishedPageBySlug, validatePageStatus } from '$lib/server/services/content/page.service'
import { createPost, updatePost } from '$lib/server/services/content/post.service'
import { slugInUse, uniqueSlugAcross, RESERVED_SLUGS } from '$lib/server/services/content/slug.service'
import { createMenu, createMenuItem, updateMenuItem, getPublicMenus, listMenus, resolvePageLinks, validateMenuUrl } from '$lib/server/services/site/menu.service'
import { runImport, getPreview } from '$lib/server/services/site/migrate.service'
import { ConflictError, NotFoundError, ValidationError } from '$lib/server/core/errors'
import { GET as listRoute, POST as createRoute } from '../../src/routes/api/pages/+server'
import { GET as getRoute, PATCH as patchRoute, DELETE as deleteRoute } from '../../src/routes/api/pages/[id]/+server'
import { POST as addMenuItemRoute } from '../../src/routes/api/menus/[id]/items/+server'
import { PUT as putMenuItemRoute } from '../../src/routes/api/menu-items/[id]/+server'
import { load as slugLoad } from '../../src/routes/[slug]/+page.server'
import { load as layoutLoad } from '../../src/routes/+layout.server'
import { call, makeEvent, seedUser, fakeR2 } from '../helpers/harness'

afterEach(() => { vi.restoreAllMocks() })

async function author() { return (await seedUser('editor')).user }
const mk = async (over: Record<string, any> = {}) => createPage(getDb(), { title: 'About Us', content: '<p>Hello</p>', authorId: (await author()).id, ...over })

describe('page service', () => {
  it('creates a draft with a slug and real timestamps', async () => {
    const p = await mk()
    expect(p).toMatchObject({ title: 'About Us', slug: 'about-us', status: 'draft', publishedAt: null })
    expect(p.createdAt).toMatch(/^\d{4}-\d\d-\d\d/)
  })

  it('stamps publishedAt on first publish and keeps it afterwards', async () => {
    const p = await mk({ status: 'publish' })
    expect(Date.parse(p.publishedAt!)).not.toBeNaN()
    const first = p.publishedAt
    await updatePage(getDb(), p.id, { status: 'draft' })
    await updatePage(getDb(), p.id, { status: 'publish', title: 'About' })
    expect((await getPageById(getDb(), p.id)).publishedAt).toBe(first)
  })

  it('auto-numbers duplicate titles and refuses explicit duplicate slugs', async () => {
    expect((await mk()).slug).toBe('about-us')
    expect((await mk()).slug).toBe('about-us-2')
    await expect(mk({ slug: 'about-us' })).rejects.toBeInstanceOf(ConflictError)
    await expect(mk({ slug: '!!!' })).rejects.toBeInstanceOf(ValidationError)
  })

  it.each([
    ['empty title', { title: '' }], ['blank title', { title: '   ' }], ['long title', { title: 'x'.repeat(301) }], ['bad status', { status: 'private' }],
  ])('rejects %s', async (_n, over) => {
    await expect(mk(over as any)).rejects.toBeInstanceOf(ValidationError)
  })

  it('sanitises content on write and on read', async () => {
    const dirty = '<p onclick="x()">ok</p><script>alert(1)</script><img src=x onerror=alert(2)>'
    const p = await mk({ content: dirty, status: 'publish' })
    expect(p.content).not.toMatch(/<script|onclick|onerror/i)
    await getDb().update(pages).set({ content: dirty }).where(eq(pages.id, p.id)) // legacy raw row
    expect((await getPublishedPageBySlug(getDb(), p.slug))!.content).not.toMatch(/<script|onclick|onerror/i)
  })

  it('update uses an allow-list (author, timestamps and id cannot be overwritten)', async () => {
    const p = await mk()
    const other = await seedUser('admin')
    await updatePage(getDb(), p.id, { title: 'Renamed', authorId: other.user.id, id: 999, createdAt: '1999-01-01', publishedAt: '1999-01-01' } as any)
    const after = await getPageById(getDb(), p.id)
    expect(after).toMatchObject({ title: 'Renamed', id: p.id, authorId: p.authorId, createdAt: p.createdAt, publishedAt: null })
  })

  it('update validates and 404s', async () => {
    const a = await mk({ title: 'A' })
    const b = await mk({ title: 'B' })
    await expect(updatePage(getDb(), a.id, { slug: b.slug })).rejects.toBeInstanceOf(ConflictError)
    await expect(updatePage(getDb(), a.id, { slug: a.slug })).resolves.toBeTruthy()
    await expect(updatePage(getDb(), a.id, { title: ' ' })).rejects.toBeInstanceOf(ValidationError)
    await expect(updatePage(getDb(), a.id, { status: 'x' })).rejects.toBeInstanceOf(ValidationError)
    await expect(updatePage(getDb(), 9999, { title: 'x' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('lists with status filters; drafts are invisible publicly', async () => {
    const live = await mk({ title: 'Live', status: 'publish' })
    const draft = await mk({ title: 'Draft' })
    expect((await listPages(getDb())).length).toBe(2)
    expect((await listPages(getDb(), { status: 'publish' })).map((p: any) => p.id)).toEqual([live.id])
    await expect(listPages(getDb(), { status: 'bogus' })).rejects.toBeInstanceOf(ValidationError)
    expect(await getPublishedPageBySlug(getDb(), live.slug)).toBeTruthy()
    expect(await getPublishedPageBySlug(getDb(), draft.slug)).toBeNull()
    expect(await getPublishedPageBySlug(getDb(), 'nope')).toBeNull()
  })

  it('deletes and 404s on repeat', async () => {
    const p = await mk()
    await deletePage(getDb(), p.id)
    await expect(deletePage(getDb(), p.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('validatePageStatus', () => {
    expect(validatePageStatus('draft')).toBe('draft')
    expect(validatePageStatus('publish')).toBe('publish')
    for (const s of ['pending', 'PUBLISH', '', null, undefined]) expect(() => validatePageStatus(s)).toThrow(ValidationError)
  })
})

describe('slugs are shared between posts and pages (both live at /<slug>)', () => {
  it('a page cannot take a post slug and a post cannot take a page slug', async () => {
    const u = await author()
    await createPost(getDb(), { title: 'Contact', content: 'x', authorId: u.id })
    await expect(mk({ slug: 'contact' })).rejects.toBeInstanceOf(ConflictError)
    expect((await mk({ title: 'Contact' })).slug).toBe('contact-2')
    await expect(createPost(getDb(), { title: 'x', slug: 'contact-2', content: 'x', authorId: u.id })).rejects.toBeInstanceOf(ConflictError)
    expect((await createPost(getDb(), { title: 'Contact 2', content: 'x', authorId: u.id })).slug).toBe('contact-2-2')
  })

  it('updating a post or a page cannot steal the other kind\'s slug', async () => {
    const u = await author()
    const post = await createPost(getDb(), { title: 'Post A', content: 'x', authorId: u.id })
    const page = await mk({ title: 'Page A' })
    await expect(updatePost(getDb(), post.id, { slug: page.slug })).rejects.toBeInstanceOf(ConflictError)
    await expect(updatePage(getDb(), page.id, { slug: post.slug })).rejects.toBeInstanceOf(ConflictError)
  })

  it.each([...RESERVED_SLUGS].filter(s => toSlug(s) === s))('reserved route "%s" can never be a slug', async slug => {
    expect(await slugInUse(getDb(), slug)).toBe(true)
    await expect(mk({ slug })).rejects.toBeInstanceOf(ConflictError)
    const u = await author()
    await expect(createPost(getDb(), { title: 'x', slug, content: 'x', authorId: u.id })).rejects.toBeInstanceOf(ConflictError)
  })

  it('reserved file-like addresses (rss.xml, _app, ...) are unreachable anyway: slugs never contain dots or underscores', async () => {
    for (const s of [...RESERVED_SLUGS].filter(s => toSlug(s) !== s)) {
      expect(s).toMatch(/[._]/)
      const p = await mk({ title: s, slug: s }) // normalised to a harmless slug such as "rss-xml"
      expect(p.slug).not.toBe(s)
      expect(p.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('titles that normalise to a reserved word get a numbered slug instead', async () => {
    expect((await mk({ title: 'Admin' })).slug).toBe('admin-2')
    expect((await mk({ title: 'API' })).slug).toBe('api-2')
  })

  it('uniqueSlugAcross ignores the row being edited', async () => {
    const p = await mk({ title: 'Same' })
    expect(await uniqueSlugAcross(getDb(), 'Same', { pageId: p.id })).toBe('same')
    expect(await uniqueSlugAcross(getDb(), 'Same')).toBe('same-2')
  })
})

describe('menus with page items', () => {
  async function setup() {
    const menu = await createMenu(getDb(), { name: 'Footer', slug: 'footer-x', location: 'footer' } as any)
    const page = await mk({ title: 'Redaksi', status: 'publish' })
    return { menu, page }
  }

  it('stores only the page id and resolves the URL from the current slug', async () => {
    const { menu, page } = await setup()
    const item = await createMenuItem(getDb(), { menuId: menu.id, itemType: 'page', pageId: page.id, label: '' })
    expect(item).toMatchObject({ itemType: 'page', pageId: page.id, label: 'Redaksi', url: '/redaksi', pageStatus: 'publish' })
    const [row] = await getDb().select().from(menuItems).where(eq(menuItems.id, item.id))
    expect(row.url).toBeNull()
  })

  it('follows page renames automatically', async () => {
    const { menu, page } = await setup()
    await createMenuItem(getDb(), { menuId: menu.id, itemType: 'page', pageId: page.id, label: 'Redaksi' })
    await updatePage(getDb(), page.id, { slug: 'tim-redaksi' })
    const [m] = (await getPublicMenus(getDb())).filter((x: any) => x.id === menu.id)
    expect(m.items[0].url).toBe('/tim-redaksi')
  })

  it('hides items from visitors when the page is a draft or deleted, but keeps them for admins', async () => {
    const { menu, page } = await setup()
    await createMenuItem(getDb(), { menuId: menu.id, itemType: 'page', pageId: page.id, label: 'Redaksi' })
    await createMenuItem(getDb(), { menuId: menu.id, label: 'Home', url: '/' })

    await updatePage(getDb(), page.id, { status: 'draft' })
    let pub = (await getPublicMenus(getDb())).find((x: any) => x.id === menu.id)!
    expect(pub.items.map((i: any) => i.label)).toEqual(['Home'])
    let admin = (await listMenus(getDb())).find((x: any) => x.id === menu.id)!
    expect(admin.items.find((i: any) => i.itemType === 'page').pageStatus).toBe('draft')

    await updatePage(getDb(), page.id, { status: 'publish' })
    pub = (await getPublicMenus(getDb())).find((x: any) => x.id === menu.id)!
    expect(pub.items).toHaveLength(2)

    await deletePage(getDb(), page.id) // FK is ON DELETE SET NULL: menu keeps working, item just disappears
    pub = (await getPublicMenus(getDb())).find((x: any) => x.id === menu.id)!
    expect(pub.items.map((i: any) => i.label)).toEqual(['Home'])
    admin = (await listMenus(getDb())).find((x: any) => x.id === menu.id)!
    expect(admin.items.find((i: any) => i.itemType === 'page')).toMatchObject({ pageStatus: 'missing', url: null })
  })

  it('validates page items', async () => {
    const { menu } = await setup()
    await expect(createMenuItem(getDb(), { menuId: menu.id, itemType: 'page', label: 'x' })).rejects.toBeInstanceOf(ValidationError)
    await expect(createMenuItem(getDb(), { menuId: menu.id, itemType: 'page', pageId: 9999, label: 'x' })).rejects.toBeInstanceOf(NotFoundError)
    await expect(createMenuItem(getDb(), { menuId: 9999, label: 'x', url: '/' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('switching an item between page and custom link keeps data consistent', async () => {
    const { menu, page } = await setup()
    const item = await createMenuItem(getDb(), { menuId: menu.id, label: 'Link', url: '/x' })
    const asPage = await updateMenuItem(getDb(), item.id, { itemType: 'page', pageId: page.id })
    expect(asPage).toMatchObject({ itemType: 'page', pageId: page.id, url: '/redaksi' })
    const back = await updateMenuItem(getDb(), item.id, { itemType: 'custom', url: 'https://example.com' })
    expect(back).toMatchObject({ itemType: 'custom', pageId: null, url: 'https://example.com' })
    await expect(updateMenuItem(getDb(), 9999, { label: 'x' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('label edits on a page item keep it linked', async () => {
    const { menu, page } = await setup()
    const item = await createMenuItem(getDb(), { menuId: menu.id, itemType: 'page', pageId: page.id, label: 'Redaksi' })
    const renamed = await updateMenuItem(getDb(), item.id, { label: 'Our Team', itemType: 'page' })
    expect(renamed).toMatchObject({ label: 'Our Team', pageId: page.id, url: '/redaksi' })
    await expect(updateMenuItem(getDb(), item.id, { label: '  ' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('resolvePageLinks leaves non-page items untouched and batches lookups', async () => {
    const { page } = await setup()
    const out = await resolvePageLinks(getDb(), [{ id: 1, itemType: 'custom', url: '/a' }, { id: 2, itemType: 'page', pageId: page.id }])
    expect(out[0]).toEqual({ id: 1, itemType: 'custom', url: '/a' })
    expect(out[1].url).toBe('/redaksi')
  })

  it.each(['/path', '/', '#top', 'https://example.com/x?y=1', 'http://example.com', 'mailto:a@b.co', 'tel:+62812', '', null, undefined])('validateMenuUrl accepts %j', u => {
    expect(() => validateMenuUrl(u)).not.toThrow()
  })
  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example', 'evil.example', 'ftp://x', ' javascript:alert(1)', { a: 1 }, 'x'.repeat(2049)])('validateMenuUrl rejects %j', u => {
    expect(() => validateMenuUrl(u as any)).toThrow(ValidationError)
  })

  it('custom links with dangerous URLs cannot be stored', async () => {
    const { menu } = await setup()
    await expect(createMenuItem(getDb(), { menuId: menu.id, label: 'x', url: 'javascript:alert(1)' })).rejects.toBeInstanceOf(ValidationError)
    const item = await createMenuItem(getDb(), { menuId: menu.id, label: 'ok', url: '/ok' })
    await expect(updateMenuItem(getDb(), item.id, { url: 'javascript:alert(1)' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('the site layout (every public page) gets resolved menus without hidden pages', async () => {
    const { menu, page } = await setup()
    await createMenuItem(getDb(), { menuId: menu.id, itemType: 'page', pageId: page.id, label: 'Redaksi' })
    const draft = await mk({ title: 'Secret' })
    await createMenuItem(getDb(), { menuId: menu.id, itemType: 'page', pageId: draft.id, label: 'Secret' })
    const data: any = await layoutLoad(makeEvent())
    const footer = data.menus.find((m: any) => m.id === menu.id)
    expect(footer.items.map((i: any) => i.url)).toEqual(['/redaksi'])
  })
})

describe('pages API', () => {
  const body = { title: 'From API', content: '<p>x</p>' }
  const make = (token?: string, b: unknown = body) => call(createRoute, makeEvent({ method: 'POST', body: b, token }))

  it('is restricted to editors and admins on every verb', async () => {
    const anon = undefined
    const authorT = (await seedUser('author')).token
    const editor = await seedUser('editor')
    const page = (await make(editor.token)).json.data
    const params = { id: String(page.id) }
    for (const t of [anon, authorT]) {
      const want = t ? 403 : 401
      expect((await call(listRoute, makeEvent({ token: t }))).status).toBe(want)
      expect((await make(t)).status).toBe(want)
      expect((await call(getRoute, makeEvent({ params, token: t }))).status).toBe(want)
      expect((await call(patchRoute, makeEvent({ method: 'PATCH', params, token: t, body: { title: 'x' } }))).status).toBe(want)
      expect((await call(deleteRoute, makeEvent({ method: 'DELETE', params, token: t }))).status).toBe(want)
    }
    expect((await call(listRoute, makeEvent({ token: editor.token }))).json.data).toHaveLength(1)
  })

  it('create/read/update/delete round trip, author comes from the token', async () => {
    const admin = await seedUser('admin')
    const r = await make(admin.token, { ...body, status: 'publish', authorId: 999 })
    expect(r.status).toBe(201)
    expect(r.json.data).toMatchObject({ slug: 'from-api', status: 'publish', authorId: admin.user.id })
    const params = { id: String(r.json.data.id) }
    expect((await call(patchRoute, makeEvent({ method: 'PATCH', params, token: admin.token, body: { title: 'Changed' } }))).json.data.title).toBe('Changed')
    expect((await call(getRoute, makeEvent({ params, token: admin.token }))).json.data.title).toBe('Changed')
    expect((await call(deleteRoute, makeEvent({ method: 'DELETE', params, token: admin.token }))).status).toBe(200)
    expect((await call(getRoute, makeEvent({ params, token: admin.token }))).status).toBe(404)
  })

  it('maps bad input to 400/409/404, never 500', async () => {
    const admin = await seedUser('admin')
    expect((await make(admin.token, { title: '' })).status).toBe(400)
    expect((await make(admin.token, '{broken')).status).toBe(400)
    expect((await make(admin.token, { ...body, slug: 'admin' })).status).toBe(409)
    expect((await make(admin.token, { ...body, slug: 'dup' })).status).toBe(201)
    expect((await make(admin.token, { ...body, slug: 'dup' })).status).toBe(409)
    expect((await call(getRoute, makeEvent({ params: { id: 'abc' }, token: admin.token }))).status).toBe(400)
    expect((await call(patchRoute, makeEvent({ method: 'PATCH', params: { id: '9999' }, token: admin.token, body: { title: 'x' } }))).status).toBe(404)
  })

  it('menu item routes accept page items and reject unsafe URLs', async () => {
    const admin = await seedUser('admin')
    const menu = await createMenu(getDb(), { name: 'M', slug: 'm-x', location: 'header' } as any)
    const page = (await make(admin.token, { ...body, status: 'publish', title: 'Kontak' })).json.data
    const add = (b: object) => call(addMenuItemRoute, makeEvent({ method: 'POST', params: { id: String(menu.id) }, token: admin.token, body: b }))
    const ok = await add({ itemType: 'page', pageId: page.id })
    expect(ok.status).toBe(201)
    expect(ok.json.data).toMatchObject({ label: 'Kontak', url: '/kontak', itemType: 'page' })
    expect((await add({ label: 'bad', url: 'javascript:alert(1)' })).status).toBe(400)
    expect((await add({ itemType: 'page', pageId: 12345 })).status).toBe(404)
    const put = await call(putMenuItemRoute, makeEvent({ method: 'PUT', params: { id: String(ok.json.data.id) }, token: admin.token, body: { label: 'Hubungi Kami' } }))
    expect(put.json.data).toMatchObject({ label: 'Hubungi Kami', url: '/kontak' })
  })
})

describe('public routing at /<slug>', () => {
  const load = (slug: string) => slugLoad(makeEvent({ params: { slug } })) as Promise<any>

  it('serves a published page, with sanitised content', async () => {
    await mk({ title: 'Tentang Kami', status: 'publish', content: '<p>Halo</p><script>alert(1)</script>' })
    const data = await load('tentang-kami')
    expect(data.kind).toBe('page')
    expect(data.page.title).toBe('Tentang Kami')
    expect(data.page.content).toContain('<p>Halo</p>')
    expect(data.page.content).not.toMatch(/<script/i)
    expect(Array.isArray(data.popular)).toBe(true)
  })

  it('draft pages and unknown slugs are 404', async () => {
    await mk({ title: 'Hidden' })
    await expect(load('hidden')).rejects.toMatchObject({ status: 404 })
    await expect(load('does-not-exist')).rejects.toMatchObject({ status: 404 })
  })

  it('posts still work and take the post branch', async () => {
    const u = await author()
    await createPost(getDb(), { title: 'Berita', content: '<p>x</p>', status: 'publish', authorId: u.id })
    expect((await load('berita')).kind).toBe('post')
  })

  it('an unpublished post does not fall through to anything', async () => {
    const u = await author()
    await createPost(getDb(), { title: 'Draft Post', content: 'x', authorId: u.id })
    await expect(load('draft-post')).rejects.toMatchObject({ status: 404 })
  })

  it('a stale post/page slug collision (legacy data) prefers the published post', async () => {
    const u = await author()
    await getDb().insert(posts).values({ authorId: u.id, title: 'Dup', slug: 'dup', content: 'post', status: 'publish' })
    await getDb().insert(pages).values({ authorId: u.id, title: 'Dup', slug: 'dup', content: 'page', status: 'publish' })
    expect((await load('dup')).kind).toBe('post')
  })
})

describe('WordPress import of pages', () => {
  const wxr = (items: string) => `<?xml version="1.0"?><rss xmlns:wp="w" xmlns:content="c" xmlns:excerpt="e"><channel>${items}</channel></rss>`
  const SAMPLE = wxr(`
    <item><title>Tentang</title><wp:post_type>page</wp:post_type><wp:post_id>10</wp:post_id><wp:post_name>tentang</wp:post_name><wp:status>publish</wp:status><wp:post_date>2022-01-02 10:00:00</wp:post_date>
      <content:encoded><![CDATA[<p onclick="x()">Tentang kami</p><script>alert(1)</script>]]></content:encoded></item>
    <item><title>Rahasia</title><wp:post_type>page</wp:post_type><wp:post_id>11</wp:post_id><wp:post_name>rahasia</wp:post_name><wp:status>draft</wp:status><content:encoded><![CDATA[<p>d</p>]]></content:encoded></item>
    <item><title>Admin</title><wp:post_type>page</wp:post_type><wp:post_id>12</wp:post_id><wp:post_name>admin</wp:post_name><wp:status>publish</wp:status><content:encoded><![CDATA[<p>sneaky</p>]]></content:encoded></item>
    <item><title>Satu Berita</title><wp:post_type>post</wp:post_type><wp:post_id>1</wp:post_id><wp:post_name>tentang</wp:post_name><wp:status>publish</wp:status><content:encoded><![CDATA[<p>post sharing a slug with a page</p>]]></content:encoded></item>
  `)

  it('previews the page count', () => {
    expect(getPreview(SAMPLE)).toMatchObject({ posts: 1, pages: 3 })
  })

  it('imports pages with status, sanitised content, and collision-free slugs shared with posts and reserved words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 404 })))
    const u = await author()
    const events: any[] = []
    await runImport(SAMPLE, getDb(), fakeR2(), u.id, e => events.push(e))
    expect(events.at(-1)).toMatchObject({ stage: 'done', totalPages: 3, totalPosts: 1 })

    const imported = await getDb().select().from(pages)
    const bySlugs = Object.fromEntries(imported.map((p: any) => [p.title, p]))
    expect(bySlugs['Rahasia']).toMatchObject({ status: 'draft', publishedAt: null })
    expect(bySlugs['Tentang']).toMatchObject({ status: 'publish', publishedAt: '2022-01-02T10:00:00' })
    expect(bySlugs['Tentang'].content).not.toMatch(/<script|onclick/i)

    const allSlugs = [...imported.map((p: any) => p.slug), ...(await getDb().select().from(posts)).map((p: any) => p.slug)]
    expect(new Set(allSlugs).size).toBe(allSlugs.length) // one namespace, no duplicates
    expect(allSlugs).not.toContain('admin') // the reserved word got a numbered slug
    expect(bySlugs['Admin'].slug).toBe('admin-2')
    vi.unstubAllGlobals()
  })
})
