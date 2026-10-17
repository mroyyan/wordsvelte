import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { posts, widgets } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { createPost } from '$lib/server/services/content/post.service'
import { getHomePage, getSiteChrome } from '$lib/server/services/content/public-site.service'
import { updateSettings } from '$lib/server/services/site/settings.service'
import { seedUser } from '../helpers/harness'

/** Ten published posts, P0 the oldest and P9 the newest; P0 also the most viewed. */
async function seed() {
  const { user } = await seedUser('editor')
  const ids: number[] = []
  for (let i = 0; i < 10; i++) {
    const p = await createPost(getDb(), { title: `P${i}`, content: '<p>x</p>', authorId: user.id, status: 'publish' })
    await getDb().update(posts).set({ publishedAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), viewCount: 100 - i }).where(eq(posts.id, p.id))
    ids.push(p.id)
  }
  return ids
}

describe('sidebar and footer post widgets', () => {
  it('"recent" is always the newest posts and "popular" the most viewed, regardless of the page being read', async () => {
    await seed()
    await updateSettings(getDb(), { posts_per_page: '3' })

    const chrome = await getSiteChrome(getDb(), undefined, 'https://news.example.com')
    expect(chrome.widgetPosts.latest.slice(0, 3).map(p => p.title)).toEqual(['P9', 'P8', 'P7'])
    expect(chrome.widgetPosts.popular.slice(0, 3).map(p => p.title)).toEqual(['P0', 'P1', 'P2'])

    // the list on page 3 of the home page is made of old posts, but the widgets do not depend on it
    const page3 = await getHomePage(getDb(), { page: 3 })
    expect(page3.posts.map(p => p.title)).toEqual(['P3', 'P2', 'P1'])
    const again = await getSiteChrome(getDb(), undefined, 'https://news.example.com')
    expect(again.widgetPosts.latest[0].title).toBe('P9')
  })

  it('ships only what the widgets show (no article bodies in every page)', async () => {
    await seed()
    const { widgetPosts } = await getSiteChrome(getDb(), undefined, 'https://news.example.com')
    expect(Object.keys(widgetPosts.latest[0]).sort()).toEqual(['createdAt', 'featuredImageUrl', 'id', 'publishedAt', 'slug', 'title', 'viewCount'])
  })

  it('does not load the lists when no such widget is active', async () => {
    await seed()
    await getDb().update(widgets).set({ status: 'inactive' })
    const { widgetPosts } = await getSiteChrome(getDb(), undefined, 'https://news.example.com')
    expect(widgetPosts).toEqual({ latest: [], popular: [] })
  })

  it('leaves out drafts and scheduled posts', async () => {
    await seed()
    const { user } = await seedUser('editor')
    await createPost(getDb(), { title: 'Draft', content: '<p>x</p>', authorId: user.id })
    await createPost(getDb(), { title: 'Later', content: '<p>x</p>', authorId: user.id, status: 'scheduled', publishedAt: new Date(Date.now() + 3_600_000).toISOString() })
    const { widgetPosts } = await getSiteChrome(getDb(), undefined, 'https://news.example.com')
    const titles = [...widgetPosts.latest, ...widgetPosts.popular].map(p => p.title)
    expect(titles).not.toContain('Draft')
    expect(titles).not.toContain('Later')
  })
})
