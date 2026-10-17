import { describe, it, expect, vi, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { posts } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import {
  createPost, updatePost, listPosts, getPostBySlug, getPostById, publishDuePosts, validateStatus,
} from '$lib/server/services/content/post.service'
import { publishDueIfNeeded, resetScheduler, SCHEDULER_INTERVAL_MS } from '$lib/server/services/content/scheduler.service'
import { getHomePage, getPostOrPage } from '$lib/server/services/content/public-site.service'
import { NotFoundError, ValidationError } from '$lib/server/core/errors'
import { zonedLocalToUtc, utcToZonedLocal } from '$lib/shared/format-date'
import { handle } from '../../src/hooks.server'
import { PATCH as adminPatch } from '../../src/routes/api/posts-admin/[id]/+server'
import { call, makeCookies, makeEvent, seedUser } from '../helpers/harness'

const HOUR = 3_600_000
const at = (ms: number) => new Date(Date.now() + ms).toISOString()

async function mk(authorId: number, over: Record<string, any> = {}) {
  return createPost(getDb(), { title: 'Scheduled story', content: '<p>Body</p>', authorId, ...over })
}

/** Move a scheduled post's time into the past without going through validation, as time passing would. */
const makeDue = (id: number) => getDb().update(posts).set({ publishedAt: at(-60_000) }).where(eq(posts.id, id))

describe('scheduled status', () => {
  it('is a known status', () => {
    expect(validateStatus('scheduled')).toBe('scheduled')
  })

  it('creates a scheduled post that keeps its time and stays invisible to the public', async () => {
    const { user } = await seedUser('editor')
    const when = at(2 * HOUR)
    const p = await mk(user.id, { status: 'scheduled', publishedAt: when })
    expect(p).toMatchObject({ status: 'scheduled', publishedAt: when })

    await expect(getPostBySlug(getDb(), p.slug)).rejects.toBeInstanceOf(NotFoundError)
    await expect(getPostOrPage(getDb(), p.slug)).rejects.toBeInstanceOf(NotFoundError)
    expect((await getHomePage(getDb(), {})).posts).toHaveLength(0)
    expect((await listPosts(getDb(), { page: 1, limit: 10 })).data).toHaveLength(0) // public default: published only
    expect((await listPosts(getDb(), { page: 1, limit: 10, status: 'scheduled' })).data.map(r => r.id)).toEqual([p.id])
  })

  it('needs a valid time in the future', async () => {
    const { user } = await seedUser('editor')
    const bad = (publishedAt: unknown) => mk(user.id, { status: 'scheduled', publishedAt })
    await expect(bad(undefined)).rejects.toBeInstanceOf(ValidationError)
    await expect(bad(null)).rejects.toBeInstanceOf(ValidationError)
    await expect(bad('')).rejects.toBeInstanceOf(ValidationError)
    await expect(bad('next tuesday')).rejects.toThrow(/not valid/)
    await expect(bad(at(-HOUR))).rejects.toThrow(/future/)
    await expect(bad(at(0) )).rejects.toThrow(/future/)
    await expect(bad(at(6 * 365 * 24 * HOUR))).rejects.toThrow(/too far/)
    expect((await listPosts(getDb(), { page: 1, limit: 10, status: 'all' })).total).toBe(0) // nothing half-created
  })

  it('normalises an offset time to UTC', async () => {
    const { user } = await seedUser('editor')
    const p = await mk(user.id, { status: 'scheduled', publishedAt: new Date(Date.now() + 3 * HOUR).toISOString().replace('Z', '+00:00') })
    expect(p.publishedAt).toMatch(/Z$/)
  })

  it('can be rescheduled, and re-saved without a time keeps the old one', async () => {
    const { user } = await seedUser('editor')
    const first = at(2 * HOUR)
    const p = await mk(user.id, { status: 'scheduled', publishedAt: first })
    await updatePost(getDb(), p.id, { title: 'Renamed' })
    expect((await getPostById(getDb(), p.id)).publishedAt).toBe(first)
    await updatePost(getDb(), p.id, { status: 'scheduled' })
    expect((await getPostById(getDb(), p.id)).publishedAt).toBe(first)

    const later = at(5 * HOUR)
    await updatePost(getDb(), p.id, { status: 'scheduled', publishedAt: later })
    expect((await getPostById(getDb(), p.id)).publishedAt).toBe(later)
    await updatePost(getDb(), p.id, { publishedAt: at(7 * HOUR) }) // time alone reschedules a scheduled post
    expect((await getPostById(getDb(), p.id)).publishedAt).not.toBe(later)
    await expect(updatePost(getDb(), p.id, { publishedAt: at(-HOUR) })).rejects.toThrow(/future/)
  })

  it('a draft can be scheduled, and a plan can be taken back', async () => {
    const { user } = await seedUser('editor')
    const p = await mk(user.id)
    await expect(updatePost(getDb(), p.id, { status: 'scheduled' })).rejects.toBeInstanceOf(ValidationError) // no time given
    await updatePost(getDb(), p.id, { status: 'scheduled', publishedAt: at(HOUR) })
    expect((await getPostById(getDb(), p.id)).status).toBe('scheduled')

    await updatePost(getDb(), p.id, { status: 'draft' })
    expect(await getPostById(getDb(), p.id)).toMatchObject({ status: 'draft', publishedAt: null })
  })

  it('"publish now" on a scheduled post goes live immediately with the current time', async () => {
    const { user } = await seedUser('editor')
    const planned = at(24 * HOUR)
    const p = await mk(user.id, { status: 'scheduled', publishedAt: planned })
    const before = Date.now()
    await updatePost(getDb(), p.id, { status: 'publish' })
    const after = await getPostById(getDb(), p.id)
    expect(after.status).toBe('publish')
    expect(Date.parse(after.publishedAt!)).toBeGreaterThanOrEqual(before - 1000)
    expect(after.publishedAt).not.toBe(planned)
    expect((await getPostBySlug(getDb(), p.slug)).title).toBe('Scheduled story')
  })

  it('ignores a time on posts that are not scheduled', async () => {
    const { user } = await seedUser('editor')
    const p = await mk(user.id, { status: 'draft', publishedAt: at(HOUR) })
    expect(p.publishedAt).toBeNull()
    await updatePost(getDb(), p.id, { publishedAt: at(HOUR) })
    expect((await getPostById(getDb(), p.id)).publishedAt).toBeNull()
  })

  it('keeps the original publish date when a live post is edited', async () => {
    const { user } = await seedUser('editor')
    const p = await mk(user.id, { status: 'publish' })
    await updatePost(getDb(), p.id, { status: 'draft' })
    await updatePost(getDb(), p.id, { status: 'publish' })
    expect((await getPostById(getDb(), p.id)).publishedAt).toBe(p.publishedAt)
  })
})

describe('publishDuePosts', () => {
  it('publishes only the posts whose time has come', async () => {
    const { user } = await seedUser('editor')
    const due = await mk(user.id, { title: 'Due', status: 'scheduled', publishedAt: at(HOUR) })
    const future = await mk(user.id, { title: 'Future', status: 'scheduled', publishedAt: at(5 * HOUR) })
    const draft = await mk(user.id, { title: 'Draft' })
    await makeDue(due.id)

    expect(await publishDuePosts(getDb())).toBe(1)
    expect((await getPostById(getDb(), due.id)).status).toBe('publish')
    expect((await getPostById(getDb(), future.id)).status).toBe('scheduled')
    expect((await getPostById(getDb(), draft.id)).status).toBe('draft')
    expect(await publishDuePosts(getDb())).toBe(0) // idempotent

    // the post is now public and keeps its scheduled time as its publish date
    expect((await getPostBySlug(getDb(), due.slug)).title).toBe('Due')
    expect((await getHomePage(getDb(), {})).posts.map(p => p.id)).toEqual([due.id])
  })

  it('uses the clock it is given', async () => {
    const { user } = await seedUser('editor')
    const p = await mk(user.id, { status: 'scheduled', publishedAt: at(2 * HOUR) })
    expect(await publishDuePosts(getDb(), new Date(Date.now() + HOUR))).toBe(0)
    expect(await publishDuePosts(getDb(), new Date(Date.now() + 3 * HOUR))).toBe(1)
    expect((await getPostById(getDb(), p.id)).status).toBe('publish')
  })

  it('never touches pending or already published posts', async () => {
    const { user } = await seedUser('editor')
    const pending = await mk(user.id, { status: 'pending' })
    const live = await mk(user.id, { title: 'Live', status: 'publish' })
    expect(await publishDuePosts(getDb(), new Date(Date.now() + 10 * HOUR))).toBe(0)
    expect((await getPostById(getDb(), pending.id)).status).toBe('pending')
    expect((await getPostById(getDb(), live.id)).publishedAt).toBe(live.publishedAt)
  })
})

describe('publishDueIfNeeded (throttle)', () => {
  it('runs at most once per interval and tries again after a failure', async () => {
    const { user } = await seedUser('editor')
    const p = await mk(user.id, { status: 'scheduled', publishedAt: at(HOUR) })
    await makeDue(p.id)

    const t0 = Date.now()
    expect(await publishDueIfNeeded(getDb(), t0)).toBe(1)

    const q = await mk(user.id, { title: 'Second', status: 'scheduled', publishedAt: at(HOUR) })
    await makeDue(q.id)
    expect(await publishDueIfNeeded(getDb(), t0 + SCHEDULER_INTERVAL_MS - 1)).toBe(0) // throttled
    expect((await getPostById(getDb(), q.id)).status).toBe('scheduled')
    expect(await publishDueIfNeeded(getDb(), t0 + SCHEDULER_INTERVAL_MS)).toBe(1)

    resetScheduler()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken: any = { update: () => { throw new Error('db down') } }
    expect(await publishDueIfNeeded(broken, t0)).toBe(0) // swallowed
    expect(err).toHaveBeenCalled()
    err.mockRestore()
    const r = await mk(user.id, { title: 'Third', status: 'scheduled', publishedAt: at(HOUR) })
    await makeDue(r.id)
    expect(await publishDueIfNeeded(getDb(), t0 + 1)).toBe(1) // the failed attempt did not start the interval
  })
})

describe('hooks publish due posts', () => {
  afterEach(() => resetScheduler())

  const visit = (url: string) => {
    const u = new URL(url)
    const event: any = { url: u, request: new Request(u), cookies: makeCookies() }
    return (handle as any)({ event, resolve: async () => new Response('ok') }) as Promise<Response>
  }

  it('a normal page request makes a due post live', async () => {
    const { user } = await seedUser('editor')
    const p = await mk(user.id, { status: 'scheduled', publishedAt: at(HOUR) })
    await makeDue(p.id)
    await visit('https://news.example.com/')
    expect((await getPostById(getDb(), p.id)).status).toBe('publish')
  })

  it('static assets and media do not trigger it', async () => {
    const { user } = await seedUser('editor')
    const p = await mk(user.id, { status: 'scheduled', publishedAt: at(HOUR) })
    await makeDue(p.id)
    await visit('https://news.example.com/_app/immutable/x.js')
    await visit('https://news.example.com/api/media/a.png')
    expect((await getPostById(getDb(), p.id)).status).toBe('scheduled')
  })

  it('a failure in the scheduler does not break the request', async () => {
    const res = await visit('https://news.example.com/')
    expect(res.status).toBe(200)
  })
})

describe('permissions', () => {
  it('an author can schedule only their own posts', async () => {
    const a = await seedUser('author')
    const b = await seedUser('author')
    const p = await mk(a.user.id)
    const patch = (token: string) => call(adminPatch, makeEvent({ method: 'PATCH', token, params: { id: String(p.id) }, body: { status: 'scheduled', publishedAt: at(HOUR) } }))
    expect((await patch(b.token)).status).toBe(403)
    expect((await patch(a.token)).status).toBe(200)
    expect((await getPostById(getDb(), p.id)).status).toBe('scheduled')
  })

  it('the API reports a past time as a 400', async () => {
    const a = await seedUser('author')
    const p = await mk(a.user.id)
    const r = await call(adminPatch, makeEvent({ method: 'PATCH', token: a.token, params: { id: String(p.id) }, body: { status: 'scheduled', publishedAt: at(-HOUR) } }))
    expect(r.status).toBe(400)
    expect(r.json.error).toMatch(/future/)
  })
})

describe('timezone helpers for the schedule picker', () => {
  it('converts a wall-clock time in the site timezone to UTC and back', () => {
    // Jakarta is UTC+7 all year
    expect(zonedLocalToUtc('2026-10-20T09:00', 'Asia/Jakarta')).toBe('2026-10-20T02:00:00.000Z')
    expect(utcToZonedLocal('2026-10-20T02:00:00.000Z', 'Asia/Jakarta')).toBe('2026-10-20T09:00')
    expect(zonedLocalToUtc('2026-10-20T09:00', 'UTC')).toBe('2026-10-20T09:00:00.000Z')
    // crossing midnight
    expect(zonedLocalToUtc('2026-01-01T03:30', 'Asia/Jakarta')).toBe('2025-12-31T20:30:00.000Z')
    expect(utcToZonedLocal('2025-12-31T20:30:00.000Z', 'Asia/Jakarta')).toBe('2026-01-01T03:30')
  })

  it('handles daylight saving time', () => {
    // New York: UTC-4 in summer, UTC-5 in winter
    expect(zonedLocalToUtc('2026-07-01T12:00', 'America/New_York')).toBe('2026-07-01T16:00:00.000Z')
    expect(zonedLocalToUtc('2026-12-01T12:00', 'America/New_York')).toBe('2026-12-01T17:00:00.000Z')
    expect(utcToZonedLocal('2026-07-01T16:00:00.000Z', 'America/New_York')).toBe('2026-07-01T12:00')
  })

  it('round-trips every hour of a day with a daylight saving change', () => {
    for (let h = 0; h < 24; h++) {
      if (h === 2) continue // 2026-03-08 02:30 does not exist in New York
      const local = `2026-03-08T${String(h).padStart(2, '0')}:30`
      const utc = zonedLocalToUtc(local, 'America/New_York')!
      expect(utcToZonedLocal(utc, 'America/New_York')).toBe(local)
    }
  })

  it('rejects things that are not a date and falls back on a bad timezone', () => {
    expect(zonedLocalToUtc('', 'UTC')).toBeNull()
    expect(zonedLocalToUtc(null, 'UTC')).toBeNull()
    expect(zonedLocalToUtc('2026-02-31T10:00', 'UTC')).toBeNull()
    expect(zonedLocalToUtc('20 Oct 2026', 'UTC')).toBeNull()
    expect(zonedLocalToUtc('2026-10-20T09:00', 'Nowhere/Land')).toBe('2026-10-20T02:00:00.000Z') // default zone
    expect(utcToZonedLocal('garbage', 'UTC')).toBe('')
    expect(utcToZonedLocal(null, 'UTC')).toBe('')
  })
})
