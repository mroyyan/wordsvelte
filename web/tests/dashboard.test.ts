import { describe, it, expect } from 'vitest'
import { posts, pages, comments, media, categories, tags } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { getDashboard, lastMonths } from '$lib/server/services/dashboard.service'
import { GET as dashboardRoute } from '../src/routes/api/dashboard/+server'
import { call, makeEvent, seedUser } from './helpers/harness'

const NOW = new Date('2026-10-16T12:00:00Z')

async function post(authorId: number, over: Record<string, any> = {}) {
  const n = Math.random().toString(36).slice(2, 8)
  const [row] = await getDb().insert(posts).values({
    authorId, title: `Post ${n}`, slug: `post-${n}`, content: 'x', status: 'publish', viewCount: 0, publishedAt: '2026-10-01T10:00:00.000Z', ...over,
  }).returning()
  return row
}

describe('lastMonths', () => {
  it('returns 12 calendar months ending at the current one, oldest first', () => {
    const m = lastMonths(NOW)
    expect(m).toHaveLength(12)
    expect(m[0]).toBe('2025-11')
    expect(m.at(-1)).toBe('2026-10')
  })

  it('crosses year boundaries correctly', () => {
    expect(lastMonths(new Date('2026-01-31T00:00:00Z'), 3)).toEqual(['2025-11', '2025-12', '2026-01'])
    expect(lastMonths(new Date('2026-03-31T00:00:00Z'), 2)).toEqual(['2026-02', '2026-03']) // 31st must not skip February
  })
})

describe('getDashboard: counts and views', () => {
  it('is all zeros on an empty site (no NaN, no missing fields)', async () => {
    const { user } = await seedUser('admin')
    const d = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    expect(d.totals).toMatchObject({ posts: 0, published: 0, drafts: 0, pending: 0, views: 0, media: 0, pages: 0, categories: 0, tags: 0, comments: 0, pendingComments: 0, users: 1 })
    expect(d.postsPerMonth).toHaveLength(12)
    expect(d.postsPerMonth.every(m => m.count === 0)).toBe(true)
    expect(d.monthDelta).toEqual({ thisMonth: 0, lastMonth: 0, difference: 0 })
    expect(d.topPosts).toEqual([])
    expect(d.recentPosts).toEqual([])
    expect(d.recentComments).toEqual([])
  })

  it('counts posts by status and sums views of PUBLISHED posts only', async () => {
    const { user } = await seedUser('admin')
    await post(user.id, { viewCount: 100 })
    await post(user.id, { viewCount: 50 })
    await post(user.id, { status: 'draft', viewCount: 9999, publishedAt: null })
    await post(user.id, { status: 'pending', viewCount: 7777, publishedAt: null })
    const { totals } = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    expect(totals).toMatchObject({ posts: 4, published: 2, drafts: 1, pending: 1, views: 150 })
  })

  it('counts the other content types, and pending comments separately', async () => {
    const { user } = await seedUser('admin')
    const p = await post(user.id)
    await getDb().insert(pages).values([{ authorId: user.id, title: 'A', slug: 'a' }, { authorId: user.id, title: 'B', slug: 'b' }])
    await getDb().insert(categories).values([{ name: 'C', slug: 'c' }])
    await getDb().insert(tags).values([{ name: 'T1', slug: 't1' }, { name: 'T2', slug: 't2' }, { name: 'T3', slug: 't3' }])
    await getDb().insert(media).values({ r2Key: 'k', originalName: 'k.png', mimeType: 'image/png', size: 1, uploadedBy: user.id })
    await getDb().insert(comments).values([
      { postId: p.id, authorName: 'a', authorEmail: 'a@x.co', content: 'one', status: 'pending' },
      { postId: p.id, authorName: 'b', authorEmail: 'b@x.co', content: 'two', status: 'approved' },
      { postId: p.id, authorName: 'c', authorEmail: 'c@x.co', content: 'three', status: 'pending' },
    ])
    const { totals } = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    expect(totals).toMatchObject({ pages: 2, categories: 1, tags: 3, media: 1, comments: 3, pendingComments: 2 })
  })
})

describe('getDashboard: monthly series', () => {
  it('buckets published posts per month, fills empty months with 0, and computes the month-over-month change', async () => {
    const { user } = await seedUser('admin')
    for (const d of ['2026-10-02T00:00:00.000Z', '2026-10-15T00:00:00.000Z', '2026-10-31T23:59:59.000Z']) await post(user.id, { publishedAt: d })
    await post(user.id, { publishedAt: '2026-09-10T00:00:00.000Z' })
    await post(user.id, { publishedAt: '2026-05-10T00:00:00.000Z' })
    const d = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    const by = Object.fromEntries(d.postsPerMonth.map(m => [m.month, m.count]))
    expect(by['2026-10']).toBe(3)
    expect(by['2026-09']).toBe(1)
    expect(by['2026-05']).toBe(1)
    expect(by['2026-08']).toBe(0)
    expect(d.monthDelta).toEqual({ thisMonth: 3, lastMonth: 1, difference: 2 })
  })

  it('ignores posts older than the 12 month window, drafts, and future-dated months outside the window', async () => {
    const { user } = await seedUser('admin')
    await post(user.id, { publishedAt: '2024-01-01T00:00:00.000Z' })
    await post(user.id, { status: 'draft', publishedAt: '2026-10-05T00:00:00.000Z' })
    const d = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    expect(d.postsPerMonth.reduce((s, m) => s + m.count, 0)).toBe(0)
  })

  it('understands both timestamp formats found in the database (ISO and SQLite datetime)', async () => {
    const { user } = await seedUser('admin')
    await post(user.id, { publishedAt: '2026-10-03T08:00:00' }) // WordPress import style
    await post(user.id, { publishedAt: null, createdAt: '2026-10-04 09:30:00' }) // column default style, never "published_at"
    const d = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    expect(d.postsPerMonth.at(-1)!.count).toBe(2)
  })

  it('a decrease shows as a negative difference', async () => {
    const { user } = await seedUser('admin')
    await post(user.id, { publishedAt: '2026-10-01T00:00:00.000Z' })
    for (let i = 0; i < 3; i++) await post(user.id, { publishedAt: '2026-09-01T00:00:00.000Z' })
    expect((await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)).monthDelta.difference).toBe(-2)
  })
})

describe('getDashboard: lists', () => {
  it('top posts: published only, most viewed first, max 5', async () => {
    const { user } = await seedUser('admin')
    for (let i = 1; i <= 7; i++) await post(user.id, { title: `Popular ${i}`, viewCount: i * 10 })
    await post(user.id, { title: 'Draft hit', status: 'draft', viewCount: 100000, publishedAt: null })
    const { topPosts } = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    expect(topPosts.map(p => p.title)).toEqual(['Popular 7', 'Popular 6', 'Popular 5', 'Popular 4', 'Popular 3'])
    expect(topPosts[0]).toMatchObject({ viewCount: 70 })
  })

  it('recent posts: newest first, includes drafts and the author name', async () => {
    const { user } = await seedUser('admin')
    await post(user.id, { title: 'Old', publishedAt: '2026-01-01T00:00:00.000Z' })
    await post(user.id, { title: 'New', publishedAt: '2026-10-10T00:00:00.000Z' })
    await post(user.id, { title: 'Draft today', status: 'draft', publishedAt: null, createdAt: '2026-10-15 10:00:00' })
    const { recentPosts } = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    expect(recentPosts.map(p => p.title)).toEqual(['Draft today', 'New', 'Old'])
    expect(recentPosts[0]).toMatchObject({ status: 'draft', authorName: user.displayName })
  })

  it('recent comments carry the post title and are newest first', async () => {
    const { user } = await seedUser('editor')
    const p = await post(user.id, { title: 'Commented post' })
    await getDb().insert(comments).values([
      { postId: p.id, authorName: 'First', authorEmail: 'f@x.co', content: 'older', createdAt: '2026-10-01 10:00:00' },
      { postId: p.id, authorName: 'Second', authorEmail: 's@x.co', content: 'newer', createdAt: '2026-10-02 10:00:00' },
    ])
    const { recentComments } = await getDashboard(getDb(), { userId: user.id, role: 'editor' }, NOW)
    expect(recentComments!.map(c => c.authorName)).toEqual(['Second', 'First'])
    expect(recentComments![0].postTitle).toBe('Commented post')
  })
})

describe('getDashboard: what each role may see', () => {
  async function scenario() {
    const author = await seedUser('author')
    const other = await seedUser('author')
    const editor = await seedUser('editor')
    const admin = await seedUser('admin')
    const mine = await post(author.user.id, { title: 'Mine', viewCount: 10 })
    await post(author.user.id, { title: 'My draft', status: 'draft', publishedAt: null })
    await post(other.user.id, { title: 'Theirs', viewCount: 500 })
    await getDb().insert(comments).values({ postId: mine.id, authorName: 'x', authorEmail: 'x@x.co', content: 'hi', status: 'pending' })
    await getDb().insert(media).values([
      { r2Key: 'a', originalName: 'a', mimeType: 'image/png', size: 1, uploadedBy: author.user.id },
      { r2Key: 'b', originalName: 'b', mimeType: 'image/png', size: 1, uploadedBy: other.user.id },
    ])
    return { author, other, editor, admin }
  }

  it('authors only see their own posts, views and media, and nothing site-wide', async () => {
    const { author } = await scenario()
    const d = await getDashboard(getDb(), { userId: author.user.id, role: 'author' }, NOW)
    expect(d.scope).toBe('own')
    expect(d.totals).toMatchObject({ posts: 2, published: 1, drafts: 1, views: 10, media: 1 })
    expect(d.topPosts.map(p => p.title)).toEqual(['Mine'])
    expect(d.recentPosts.map(p => p.title).sort()).toEqual(['Mine', 'My draft'])
    for (const key of ['pages', 'categories', 'tags', 'comments', 'pendingComments', 'users']) expect(d.totals).not.toHaveProperty(key)
    expect(d.recentComments).toBeUndefined()
  })

  it('editors see the whole site including comments, but not the user count', async () => {
    const { editor } = await scenario()
    const d = await getDashboard(getDb(), { userId: editor.user.id, role: 'editor' }, NOW)
    expect(d.scope).toBe('site')
    expect(d.totals).toMatchObject({ posts: 3, published: 2, views: 510, media: 2, pendingComments: 1 })
    expect(d.totals).not.toHaveProperty('users')
    expect(d.recentComments).toHaveLength(1)
  })

  it('admins additionally get the user count', async () => {
    const { admin } = await scenario()
    expect((await getDashboard(getDb(), { userId: admin.user.id, role: 'admin' }, NOW)).totals.users).toBe(4)
  })
})

describe('GET /api/dashboard', () => {
  it('401 anonymous; 200 for every signed-in role with role-appropriate payloads', async () => {
    expect((await call(dashboardRoute, makeEvent())).status).toBe(401)
    const author = await seedUser('author')
    const admin = await seedUser('admin')
    const a = await call(dashboardRoute, makeEvent({ token: author.token }))
    expect(a.status).toBe(200)
    expect(a.json.data.scope).toBe('own')
    expect(a.json.data.totals.users).toBeUndefined()
    const b = await call(dashboardRoute, makeEvent({ token: admin.token }))
    expect(b.json.data.scope).toBe('site')
    expect(b.json.data.totals.users).toBe(2)
    expect(a.text).not.toMatch(/passwordHash|authorEmail/)
  })

  it('does not leak commenter emails even to editors', async () => {
    const editor = await seedUser('editor')
    const p = await post(editor.user.id)
    await getDb().insert(comments).values({ postId: p.id, authorName: 'x', authorEmail: 'private@secret.test', content: 'hi' })
    const r = await call(dashboardRoute, makeEvent({ token: editor.token }))
    expect(r.text).not.toContain('private@secret.test')
  })
})
