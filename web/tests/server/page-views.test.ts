import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { postViews, posts } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { createPost, deletePost, getPostBySlug } from '$lib/server/services/content/post.service'
import { getPostOrPage } from '$lib/server/services/content/public-site.service'
import { DAYS_IN_VIEWS_CHART, getDashboard, lastDays } from '$lib/server/services/site/dashboard.service'
import { recordView, dayKey } from '$lib/server/repositories/views.repository'
import { seedUser } from '../helpers/harness'

const NOW = new Date('2026-10-17T15:30:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000)

async function mk(authorId: number, title: string) {
  return createPost(getDb(), { title, content: '<p>x</p>', authorId, status: 'publish' })
}
const rows = () => getDb().select().from(postViews)

describe('counting views per day', () => {
  it('a reader opening an article on the site counts once for today, and the all-time counter still moves', async () => {
    const { user } = await seedUser('author')
    const p = await mk(user.id, 'Hello')
    await getPostOrPage(getDb(), p.slug)
    await getPostOrPage(getDb(), p.slug)
    expect(await rows()).toEqual([{ postId: p.id, day: dayKey(new Date()), views: 2 }])
    expect((await getDb().select().from(posts).where(eq(posts.id, p.id)))[0].viewCount).toBe(2)
  })

  it('the public API counts the same way', async () => {
    const { user } = await seedUser('author')
    const p = await mk(user.id, 'Via API')
    await getPostBySlug(getDb(), p.slug)
    expect((await rows())[0]).toMatchObject({ postId: p.id, views: 1 })
  })

  it('drafts and unknown slugs count nothing', async () => {
    const { user } = await seedUser('author')
    const draft = await createPost(getDb(), { title: 'Draft', content: '<p>x</p>', authorId: user.id })
    await getPostOrPage(getDb(), draft.slug).catch(() => {})
    await getPostOrPage(getDb(), 'no-such-post').catch(() => {})
    expect(await rows()).toEqual([])
  })

  it('keeps one row per post and day, adding up simultaneous views', async () => {
    const { user } = await seedUser('author')
    const p = await mk(user.id, 'Busy')
    await Promise.all(Array.from({ length: 20 }, () => recordView(getDb(), p.id, NOW)))
    await recordView(getDb(), p.id, daysAgo(1))
    const all = await rows()
    expect(all).toHaveLength(2)
    expect(all.find(r => r.day === '2026-10-17')!.views).toBe(20)
  })

  it('goes away with the post', async () => {
    const { user } = await seedUser('author')
    const p = await mk(user.id, 'Short lived')
    await recordView(getDb(), p.id, NOW)
    await deletePost(getDb(), p.id)
    expect(await rows()).toEqual([])
  })
})

describe('the dashboard chart', () => {
  it('lists the last 30 days oldest first, ending today', () => {
    const days = lastDays(NOW)
    expect(days).toHaveLength(DAYS_IN_VIEWS_CHART)
    expect(days.at(-1)).toBe('2026-10-17')
    expect(days[0]).toBe('2026-09-18')
    expect([...days].sort()).toEqual(days)
    expect(lastDays(new Date('2026-03-02T00:00:00Z'), 3)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']) // across a month end
  })

  it('shows views per day with zeros for quiet days, adding up every post', async () => {
    const { user } = await seedUser('admin')
    const a = await mk(user.id, 'A')
    const b = await mk(user.id, 'B')
    await recordView(getDb(), a.id, NOW)
    await recordView(getDb(), b.id, NOW)
    await recordView(getDb(), b.id, NOW)
    await recordView(getDb(), a.id, daysAgo(3))
    await recordView(getDb(), a.id, daysAgo(29))
    await recordView(getDb(), a.id, daysAgo(30)) // outside the window

    const { viewsPerDay } = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    expect(viewsPerDay).toHaveLength(30)
    const at = (n: number) => viewsPerDay.find(d => d.day === dayKey(daysAgo(n)))!.views
    expect([at(0), at(3), at(29)]).toEqual([3, 1, 1])
    expect(viewsPerDay.filter(d => d.views > 0)).toHaveLength(3)
    expect(viewsPerDay.reduce((n, d) => n + d.views, 0)).toBe(5)
  })

  it('an author sees only the views of their own articles', async () => {
    const mine = await seedUser('author')
    const other = await seedUser('author')
    const p = await mk(mine.user.id, 'Mine')
    const q = await mk(other.user.id, 'Theirs')
    await recordView(getDb(), p.id, NOW)
    await recordView(getDb(), q.id, NOW)
    await recordView(getDb(), q.id, NOW)

    const own = await getDashboard(getDb(), { userId: mine.user.id, role: 'author' }, NOW)
    expect(own.viewsPerDay.at(-1)!.views).toBe(1)
    const editor = await seedUser('editor')
    const all = await getDashboard(getDb(), { userId: editor.user.id, role: 'editor' }, NOW)
    expect(all.viewsPerDay.at(-1)!.views).toBe(3)
  })

  it('is all zeros before anything was read', async () => {
    const { user } = await seedUser('admin')
    const { viewsPerDay } = await getDashboard(getDb(), { userId: user.id, role: 'admin' }, NOW)
    expect(viewsPerDay.every(d => d.views === 0)).toBe(true)
  })
})
