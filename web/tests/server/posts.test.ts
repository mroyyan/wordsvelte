import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { posts, categories, tags, comments, postCategories } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import {
  createPost, updatePost, deletePost, listPosts, getPostBySlug, getPostById, setFeaturedPosts, getFeaturedPosts, validateStatus,
} from '$lib/server/services/content/post.service'
import { createCategory } from '$lib/server/services/content/category.service'
import { createTag } from '$lib/server/services/content/tag.service'
import { ConflictError, NotFoundError, ValidationError } from '$lib/server/core/errors'
import { GET as publicList, POST as createRoute } from '../../src/routes/api/posts/+server'
import { GET as adminList } from '../../src/routes/api/posts-admin/+server'
import { GET as adminGet, PATCH as adminPatch, DELETE as adminDelete } from '../../src/routes/api/posts-admin/[id]/+server'
import { GET as bySlug } from '../../src/routes/api/posts/[slug]/+server'
import { call, makeEvent, seedUser } from '../helpers/harness'

async function mkPost(authorId: number, over: Record<string, any> = {}) {
  return createPost(getDb(), { title: 'Hello World', content: '<p>Body</p>', authorId, ...over })
}

describe('createPost', () => {
  it('creates a draft with a slug, real timestamps and sane defaults', async () => {
    const { user } = await seedUser('author')
    const p = await mkPost(user.id)
    expect(p).toMatchObject({ title: 'Hello World', slug: 'hello-world', status: 'draft', isFeatured: false, viewCount: 0, publishedAt: null, authorId: user.id })
    expect(p.categories).toEqual([])
  })

  it('sets publishedAt only when created as published', async () => {
    const { user } = await seedUser('author')
    const p = await mkPost(user.id, { status: 'publish' })
    expect(Date.parse(p.publishedAt!)).not.toBeNaN()
  })

  it('auto-generates unique slugs (-2, -3) instead of crashing on duplicates', async () => {
    const { user } = await seedUser('author')
    const slugs = [(await mkPost(user.id)).slug, (await mkPost(user.id)).slug, (await mkPost(user.id)).slug]
    expect(slugs).toEqual(['hello-world', 'hello-world-2', 'hello-world-3'])
  })

  it('409s when an explicit slug is already in use, and normalises explicit slugs', async () => {
    const { user } = await seedUser('author')
    await mkPost(user.id, { slug: 'My Custom Slug!' })
    expect((await getPostById(getDb(), 1)).slug).toBe('my-custom-slug')
    await expect(mkPost(user.id, { slug: 'my-custom-slug' })).rejects.toBeInstanceOf(ConflictError)
    await expect(mkPost(user.id, { slug: '!!!' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('falls back to a safe slug for titles with no latin characters', async () => {
    const { user } = await seedUser('author')
    expect((await mkPost(user.id, { title: '日本語のニュース' })).slug).toBe('post')
  })

  it.each([
    ['missing title', { title: '' }],
    ['whitespace title', { title: '   ' }],
    ['missing content', { content: '' }],
    ['overlong title', { title: 'x'.repeat(301) }],
    ['bad status', { status: 'published' }],
    ['non-array categoryIds', { categoryIds: 'abc' }],
    ['non-integer tagIds', { tagIds: [1.5] }],
    ['negative ids', { categoryIds: [-1] }],
    ['nonexistent category', { categoryIds: [9999] }],
    ['nonexistent tag', { tagIds: [9999] }],
    ['javascript: image', { featuredImageUrl: 'javascript:alert(1)' }],
    ['data: image', { featuredImageUrl: 'data:text/html,<script>alert(1)</script>' }],
    ['protocol-relative image', { featuredImageUrl: '//evil.com/x.png' }],
    ['non-string image', { featuredImageUrl: { a: 1 } }],
  ])('rejects %s with a 400, not a 500', async (_n, over) => {
    const { user } = await seedUser('author')
    await expect(mkPost(user.id, over as any)).rejects.toBeInstanceOf(ValidationError)
  })

  it('accepts local-path and http(s) featured images', async () => {
    const { user } = await seedUser('author')
    expect((await mkPost(user.id, { featuredImageUrl: '/api/media/2024/01/x.png' })).featuredImageUrl).toBe('/api/media/2024/01/x.png')
    expect((await mkPost(user.id, { featuredImageUrl: 'https://cdn.example.com/a.jpg' })).featuredImageUrl).toBe('https://cdn.example.com/a.jpg')
  })

  it('links existing categories and tags (deduplicated)', async () => {
    const { user } = await seedUser('author')
    const cat = await createCategory(getDb(), { name: 'Nasional' })
    const tag = await createTag(getDb(), { name: 'Politik' })
    const p = await mkPost(user.id, { categoryIds: [cat.id, cat.id], tagIds: [tag.id] })
    expect(p.categories).toHaveLength(1)
    expect(p.tags).toHaveLength(1)
  })
})

describe('XSS: content is sanitised on write', () => {
  const dirty =
    '<p onclick="alert(1)">hi</p><script>alert(2)</script><img src=x onerror="alert(3)"><a href="javascript:alert(4)">x</a>' +
    '<iframe src="https://evil.com"></iframe><svg onload=alert(5)></svg><style>*{display:none}</style><b>ok</b>'

  it('strips scripts, handlers, javascript: URLs, iframes, svg and styles but keeps formatting', async () => {
    const { user } = await seedUser('author')
    const p = await mkPost(user.id, { content: dirty, excerpt: '<script>x</script>short' })
    const html = p.content as string
    expect(html).not.toMatch(/<script|onerror|onclick|onload|javascript:|<iframe|<svg|<style/i)
    expect(html).toContain('<b>ok</b>')
    expect(html).toContain('hi')
    expect(p.excerpt).not.toMatch(/script/i)
  })

  it('also sanitises on update', async () => {
    const { user } = await seedUser('author')
    const p = await mkPost(user.id)
    await updatePost(getDb(), p.id, { content: dirty })
    expect((await getPostById(getDb(), p.id)).content).not.toMatch(/<script|onerror|javascript:/i)
  })

  it('and defensively on read, so legacy/imported rows with raw HTML are cleaned too', async () => {
    const { user } = await seedUser('author')
    await getDb().insert(posts).values({ authorId: user.id, title: 'Legacy', slug: 'legacy', content: dirty, status: 'publish' })
    const post = await getPostBySlug(getDb(), 'legacy')
    expect(post.content).not.toMatch(/<script|onerror|javascript:/i)
  })
})

describe('updatePost', () => {
  it('ignores fields outside the allow-list (mass-assignment protection)', async () => {
    const owner = await seedUser('author')
    const other = await seedUser('author')
    const p = await mkPost(owner.user.id)
    await updatePost(getDb(), p.id, {
      title: 'Renamed', authorId: other.user.id, viewCount: 999999, id: 12345, createdAt: '1999-01-01', publishedAt: '1999-01-01',
    } as any)
    const after = await getPostById(getDb(), p.id)
    expect(after.title).toBe('Renamed')
    expect(after.authorId).toBe(owner.user.id)
    expect(after.viewCount).toBe(0)
    expect(after.id).toBe(p.id)
    expect(after.createdAt).toBe(p.createdAt)
    expect(after.publishedAt).toBeNull()
  })

  it('stamps publishedAt on first publish and keeps it on later edits/unpublish-republish', async () => {
    const { user } = await seedUser('author')
    const p = await mkPost(user.id)
    await updatePost(getDb(), p.id, { status: 'publish' })
    const first = (await getPostById(getDb(), p.id)).publishedAt
    expect(first).toBeTruthy()
    await updatePost(getDb(), p.id, { title: 'Edited' })
    await updatePost(getDb(), p.id, { status: 'draft' })
    await updatePost(getDb(), p.id, { status: 'publish' })
    expect((await getPostById(getDb(), p.id)).publishedAt).toBe(first)
  })

  it('validates status, slug conflicts and empty fields; unchanged slug is fine', async () => {
    const { user } = await seedUser('author')
    const a = await mkPost(user.id, { title: 'Alpha' })
    const b = await mkPost(user.id, { title: 'Beta' })
    await expect(updatePost(getDb(), a.id, { status: 'archived' })).rejects.toBeInstanceOf(ValidationError)
    await expect(updatePost(getDb(), a.id, { slug: b.slug })).rejects.toBeInstanceOf(ConflictError)
    await expect(updatePost(getDb(), a.id, { slug: a.slug })).resolves.toBeUndefined()
    await expect(updatePost(getDb(), a.id, { title: ' ' })).rejects.toBeInstanceOf(ValidationError)
    await expect(updatePost(getDb(), a.id, { content: '' })).rejects.toBeInstanceOf(ValidationError)
    await expect(updatePost(getDb(), 999, { title: 'x' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('replaces categories/tags, and clears them with an empty array', async () => {
    const { user } = await seedUser('author')
    const c1 = await createCategory(getDb(), { name: 'One' })
    const c2 = await createCategory(getDb(), { name: 'Two' })
    const p = await mkPost(user.id, { categoryIds: [c1.id] })
    await updatePost(getDb(), p.id, { categoryIds: [c2.id] })
    expect((await getPostById(getDb(), p.id)).categories.map((c: any) => c.id)).toEqual([c2.id])
    await updatePost(getDb(), p.id, { categoryIds: [] })
    expect((await getPostById(getDb(), p.id)).categories).toEqual([])
    await updatePost(getDb(), p.id, { title: 'untouched relations' }) // omitted => unchanged
    await updatePost(getDb(), p.id, { categoryIds: [c1.id] })
    await updatePost(getDb(), p.id, { title: 'again' })
    expect((await getPostById(getDb(), p.id)).categories).toHaveLength(1)
  })

  it('does not wipe relations when validation of the new relations fails', async () => {
    const { user } = await seedUser('author')
    const c1 = await createCategory(getDb(), { name: 'One' })
    const p = await mkPost(user.id, { categoryIds: [c1.id] })
    await expect(updatePost(getDb(), p.id, { categoryIds: [9999] })).rejects.toBeInstanceOf(ValidationError)
    expect((await getPostById(getDb(), p.id)).categories).toHaveLength(1)
  })
})

describe('deletePost', () => {
  it('deletes (cascading relations) and 404s afterwards', async () => {
    const { user } = await seedUser('author')
    const cat = await createCategory(getDb(), { name: 'C' })
    const p = await mkPost(user.id, { categoryIds: [cat.id] })
    await deletePost(getDb(), p.id)
    expect(await getDb().select().from(postCategories).where(eq(postCategories.postId, p.id))).toHaveLength(0)
    await expect(deletePost(getDb(), p.id)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('listPosts', () => {
  async function seedMany() {
    const { user } = await seedUser('author')
    await mkPost(user.id, { title: 'Published A', status: 'publish' })
    await mkPost(user.id, { title: 'Published B', status: 'publish' })
    await mkPost(user.id, { title: 'A Draft', status: 'draft' })
    await mkPost(user.id, { title: '100% Real_Deal', status: 'publish' })
    return user
  }

  it('defaults to published only; "all" and explicit statuses work for admin views', async () => {
    await seedMany()
    expect((await listPosts(getDb(), { page: 1, limit: 20 })).total).toBe(3)
    expect((await listPosts(getDb(), { page: 1, limit: 20, status: 'all' })).total).toBe(4)
    expect((await listPosts(getDb(), { page: 1, limit: 20, status: 'draft' })).data.map((p: any) => p.title)).toEqual(['A Draft'])
    await expect(listPosts(getDb(), { page: 1, limit: 20, status: 'nonsense' })).rejects.toBeInstanceOf(ValidationError)
  })

  it('treats LIKE wildcards in the search term literally', async () => {
    await seedMany()
    const find = async (q: string) => (await listPosts(getDb(), { page: 1, limit: 20, status: 'all', search: q })).data.map((p: any) => p.title)
    expect(await find('%')).toEqual(['100% Real_Deal'])
    expect(await find('_')).toEqual(['100% Real_Deal'])
    expect(await find('Published')).toHaveLength(2)
    expect(await find("'; DROP TABLE posts; --")).toEqual([])
    expect((await listPosts(getDb(), { page: 1, limit: 20 })).total).toBe(3) // table still there
  })

  it('paginates deterministically and clamps absurd limits/pages', async () => {
    await seedMany()
    const p1 = await listPosts(getDb(), { page: 1, limit: 2, status: 'all' })
    const p2 = await listPosts(getDb(), { page: 2, limit: 2, status: 'all' })
    expect(p1.data).toHaveLength(2)
    expect(p2.data).toHaveLength(2)
    expect(new Set([...p1.data, ...p2.data].map((p: any) => p.id)).size).toBe(4)
    expect(p1.totalPages).toBe(2)
    expect((await listPosts(getDb(), { page: 1, limit: 10_000, status: 'all' })).limit).toBe(500)
    expect((await listPosts(getDb(), { page: -4, limit: 0, status: 'all' })).page).toBe(1)
  })

  it('filters by author and by category', async () => {
    const a = await seedUser('author')
    const b = await seedUser('author')
    const cat = await createCategory(getDb(), { name: 'Cat' })
    await mkPost(a.user.id, { title: 'by a', status: 'publish', categoryIds: [cat.id] })
    await mkPost(b.user.id, { title: 'by b', status: 'publish' })
    expect((await listPosts(getDb(), { page: 1, limit: 20, authorId: a.user.id })).data).toHaveLength(1)
    expect((await listPosts(getDb(), { page: 1, limit: 20, categoryId: cat.id })).data.map((p: any) => p.title)).toEqual(['by a'])
  })
})

describe('getPostBySlug (public)', () => {
  it('only exposes published posts', async () => {
    const { user } = await seedUser('author')
    await mkPost(user.id, { title: 'Secret Draft' })
    await expect(getPostBySlug(getDb(), 'secret-draft')).rejects.toBeInstanceOf(NotFoundError)
    await expect(getPostBySlug(getDb(), 'missing')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('returns only APPROVED comments and never commenter emails', async () => {
    const { user } = await seedUser('author')
    const p = await mkPost(user.id, { status: 'publish' })
    const mk = (status: string, n: string) => getDb().insert(comments).values({ postId: p.id, authorName: n, authorEmail: `${n}@secret.test`, content: `c-${n}`, status })
    await mk('approved', 'good')
    await mk('pending', 'pend')
    await mk('spam', 'spam')
    await mk('trash', 'trash')
    const post = await getPostBySlug(getDb(), p.slug)
    expect(post.comments.map((c: any) => c.authorName)).toEqual(['good'])
    expect(JSON.stringify(post)).not.toContain('@secret.test')
  })

  it('increments the view counter', async () => {
    const { user } = await seedUser('author')
    const p = await mkPost(user.id, { status: 'publish' })
    await getPostBySlug(getDb(), p.slug)
    await getPostBySlug(getDb(), p.slug)
    expect((await getPostById(getDb(), p.id)).viewCount).toBe(2)
  })
})

describe('featured posts', () => {
  async function publishN(n: number) {
    const { user } = await seedUser('editor')
    const out = []
    for (let i = 0; i < n; i++) {
      const p = await mkPost(user.id, { title: `Post ${i}`, status: 'publish' })
      // deterministic ordering for "oldest"
      await getDb().update(posts).set({ publishedAt: `2024-01-0${i + 1}T00:00:00.000Z` }).where(eq(posts.id, p.id))
      out.push(p)
    }
    return out
  }

  it('keeps at most 5 featured: featuring a 6th drops the oldest', async () => {
    const ps = await publishN(6)
    for (const p of ps.slice(0, 5)) await setFeaturedPosts(getDb(), p.id, true)
    expect(await getFeaturedPosts(getDb())).toHaveLength(5)
    await setFeaturedPosts(getDb(), ps[5].id, true)
    const featured = await getFeaturedPosts(getDb())
    expect(featured).toHaveLength(5)
    expect(featured.map((p: any) => p.id)).not.toContain(ps[0].id)
    expect(featured.map((p: any) => p.id)).toContain(ps[5].id)
  })

  it('re-featuring an already featured post never evicts itself or others', async () => {
    const ps = await publishN(5)
    for (const p of ps) await setFeaturedPosts(getDb(), p.id, true)
    await setFeaturedPosts(getDb(), ps[2].id, true)
    expect(await getFeaturedPosts(getDb())).toHaveLength(5)
  })

  it('drafts never appear in featured, and do not consume slots', async () => {
    const { user } = await seedUser('editor')
    const draft = await mkPost(user.id, { title: 'Draft Featured' })
    await setFeaturedPosts(getDb(), draft.id, true)
    expect(await getFeaturedPosts(getDb())).toHaveLength(0)
    const ps = await publishN(5)
    for (const p of ps) await setFeaturedPosts(getDb(), p.id, true)
    expect(await getFeaturedPosts(getDb())).toHaveLength(5)
  })

  it('can be toggled via updatePost and unfeatured', async () => {
    const [p] = await publishN(1)
    await updatePost(getDb(), p.id, { isFeatured: true })
    expect((await getPostById(getDb(), p.id)).isFeatured).toBe(true)
    await updatePost(getDb(), p.id, { isFeatured: false })
    expect((await getPostById(getDb(), p.id)).isFeatured).toBe(false)
  })
})

describe('validateStatus', () => {
  it('accepts the known statuses only', () => {
    for (const s of ['draft', 'pending', 'publish']) expect(validateStatus(s)).toBe(s)
    for (const s of ['', 'PUBLISH', 'published', null, undefined, 1]) expect(() => validateStatus(s)).toThrow(ValidationError)
  })
})

describe('posts API', () => {
  const body = { title: 'From API', content: '<p>x</p>' }
  const create = (token: string | undefined, b: unknown = body) => call(createRoute, makeEvent({ method: 'POST', body: b, token }))

  it('POST requires auth; sets authorId from the token, never from the body', async () => {
    const author = await seedUser('author')
    const other = await seedUser('author')
    expect((await create(undefined)).status).toBe(401)
    const r = await create(author.token, { ...body, authorId: other.user.id })
    expect(r.status).toBe(201)
    expect(r.json.data.authorId).toBe(author.user.id)
  })

  it('authors cannot feature posts; editors can', async () => {
    const author = await seedUser('author')
    const editor = await seedUser('editor')
    const a = await create(author.token, { ...body, status: 'publish', isFeatured: true })
    expect(a.json.data.isFeatured).toBe(false)
    const e = await create(editor.token, { ...body, title: 'Editor pick', status: 'publish', isFeatured: true })
    expect(e.json.data.isFeatured).toBe(true)
  })

  it('400 on invalid payloads, 409 on slug clash', async () => {
    const author = await seedUser('author')
    expect((await create(author.token, { title: '', content: 'x' })).status).toBe(400)
    expect((await create(author.token, '{bad json')).status).toBe(400)
    expect((await create(author.token, { ...body, slug: 'dup' })).status).toBe(201)
    expect((await create(author.token, { ...body, slug: 'dup' })).status).toBe(409)
  })

  it('public list shows published only and survives hostile query params', async () => {
    const author = await seedUser('author')
    await create(author.token, { ...body, title: 'Live', status: 'publish' })
    await create(author.token, { ...body, title: 'Hidden' })
    const r = await call(publicList, makeEvent({ query: { page: 'abc', limit: '99999', categoryId: 'x', q: '%' } }))
    expect(r.status).toBe(200)
    expect(r.json.limit).toBe(100)
    const all = await call(publicList, makeEvent({ query: { status: 'draft' } })) // status param must be ignored
    expect(all.json.data.map((p: any) => p.title)).toEqual(['Live'])
  })

  it('public by-slug route 404s for drafts', async () => {
    const author = await seedUser('author')
    await create(author.token, { ...body, title: 'Hidden' })
    expect((await call(bySlug, makeEvent({ params: { slug: 'hidden' } }))).status).toBe(404)
  })

  describe('ownership on /api/posts-admin', () => {
    async function setup() {
      const alice = await seedUser('author')
      const bob = await seedUser('author')
      const editor = await seedUser('editor')
      const post = (await create(alice.token, { ...body, title: 'Alice post' })).json.data
      return { alice, bob, editor, post }
    }
    const ev = (token: string | undefined, id: number | string, method = 'GET', b?: unknown) =>
      makeEvent({ method, params: { id: String(id) }, token, body: b })

    it('authors can read/edit/delete their own posts', async () => {
      const { alice, post } = await setup()
      expect((await call(adminGet, ev(alice.token, post.id))).status).toBe(200)
      expect((await call(adminPatch, ev(alice.token, post.id, 'PATCH', { title: 'Mine, edited' }))).status).toBe(200)
      expect((await call(adminDelete, ev(alice.token, post.id, 'DELETE'))).status).toBe(200)
    })

    it('authors get 403 on other authors\' posts for every verb (IDOR)', async () => {
      const { bob, post } = await setup()
      expect((await call(adminGet, ev(bob.token, post.id))).status).toBe(403)
      expect((await call(adminPatch, ev(bob.token, post.id, 'PATCH', { title: 'Hijacked' }))).status).toBe(403)
      expect((await call(adminDelete, ev(bob.token, post.id, 'DELETE'))).status).toBe(403)
      expect((await getPostById(getDb(), post.id)).title).toBe('Alice post')
    })

    it('editors and admins can manage any post', async () => {
      const { editor, post } = await setup()
      expect((await call(adminPatch, ev(editor.token, post.id, 'PATCH', { title: 'Edited by editor', isFeatured: false }))).status).toBe(200)
      expect((await call(adminDelete, ev(editor.token, post.id, 'DELETE'))).status).toBe(200)
    })

    it('anonymous gets 401; bad/missing ids get 400/404', async () => {
      const { alice, post } = await setup()
      expect((await call(adminGet, ev(undefined, post.id))).status).toBe(401)
      expect((await call(adminGet, ev(alice.token, 'abc'))).status).toBe(400)
      expect((await call(adminGet, ev(alice.token, 99999))).status).toBe(404)
      expect((await call(adminDelete, ev(alice.token, 99999, 'DELETE'))).status).toBe(404)
    })

    it('author attempts to feature or reassign via PATCH are ignored', async () => {
      const { alice, bob, post } = await setup()
      await call(adminPatch, ev(alice.token, post.id, 'PATCH', { isFeatured: true, authorId: bob.user.id, status: 'publish' }))
      const after = await getPostById(getDb(), post.id)
      expect(after.isFeatured).toBe(false)
      expect(after.authorId).toBe(alice.user.id)
      expect(after.status).toBe('publish') // authors may publish their own work
    })

    it('list shows drafts to admins; authors only see their own', async () => {
      const { alice, bob, editor } = await setup()
      await create(bob.token, { ...body, title: 'Bob draft' })
      const aliceView = await call(adminList, makeEvent({ token: alice.token }))
      expect(aliceView.json.data.map((p: any) => p.title)).toEqual(['Alice post'])
      const editorView = await call(adminList, makeEvent({ token: editor.token, query: { limit: '500' } }))
      expect(editorView.json.total).toBe(2)
      expect((await call(adminList, makeEvent())).status).toBe(401)
    })
  })
})

describe('schema defaults', () => {
  it('created_at defaults are real timestamps, not the literal text of the SQL function (old bug)', async () => {
    const [cat] = await getDb().insert(categories).values({ name: 'X', slug: 'x' }).returning()
    const [tag] = await getDb().insert(tags).values({ name: 'T', slug: 't' }).returning()
    for (const row of [cat, tag]) {
      expect(row.createdAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
      expect(row.createdAt).not.toContain('datetime')
    }
  })
})
