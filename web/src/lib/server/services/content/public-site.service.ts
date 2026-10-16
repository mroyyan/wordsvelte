import type { DbInstance } from '$lib/server/db'
import { NotFoundError } from '$lib/server/core/errors'
import { sanitizeHtml } from '$lib/server/core/sanitize'
import { createPublicSiteRepository } from '$lib/server/repositories/public-site.repository'
import { getSite } from '$lib/server/seo/site'
import { rssXml } from '$lib/server/seo/rss'
import { scanThemes, setActiveTheme } from '$lib/server/themes'
import { siteOrigin, snippet, stripHtml } from '$lib/shared/seo'
import { parseStoredDate } from '$lib/shared/format-date'
import { listCommentsByPost } from '$lib/server/services/content/comment.service'
import { getPublishedPageBySlug } from '$lib/server/services/content/page.service'
import { getFeaturedPosts, getPopularPosts } from '$lib/server/services/content/post.service'
import { getPublicMenus } from '$lib/server/services/site/menu.service'
import { getSettings } from '$lib/server/services/site/settings.service'

/** What every public page needs: public settings, widgets, menus and the active theme. */
export async function getSiteChrome(db: DbInstance, platform: App.Platform | undefined, requestOrigin: string) {
  // Public scope only: this object is serialised into every page, so it must never contain secrets.
  const settings = await getSettings(db)
  const widgets = await createPublicSiteRepository(db).activeWidgets()
  // Page-type items are resolved to their current slug; unpublished/missing pages are dropped.
  const menus = await getPublicMenus(db)

  const theme = settings['theme'] || 'default'
  await scanThemes(platform)
  await setActiveTheme(theme, platform)

  return { settings, siteUrl: siteOrigin(settings.site_url, requestOrigin), widgets, menus, theme }
}

const DEFAULT_PER_PAGE = 20
const MAX_PER_PAGE = 100

export async function getHomePage(db: DbInstance, opts: { page?: unknown }) {
  const site = createPublicSiteRepository(db)
  const settings = await getSettings(db)
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(settings.posts_per_page || '') || DEFAULT_PER_PAGE))
  const page = Math.max(1, parseInt(String(opts.page ?? '')) || 1)

  const [featuredPosts, total, posts, categories, tags] = await Promise.all([
    getFeaturedPosts(db, 5),
    site.countPublished(),
    site.listPublished(perPage, (page - 1) * perPage),
    site.allCategories(),
    site.allTags(),
  ])
  return { posts, featuredPosts, categories, tags, pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) } }
}

export async function getCategoryArchive(db: DbInstance, slug: string) {
  const site = createPublicSiteRepository(db)
  const category = await site.findCategoryBySlug(slug)
  if (!category) throw new NotFoundError('Category')
  return { category, posts: await site.listPublishedInCategory(category.id), categories: await site.allCategories(), tags: await site.allTags() }
}

export async function getTagArchive(db: DbInstance, slug: string) {
  const site = createPublicSiteRepository(db)
  const tag = await site.findTagBySlug(slug)
  if (!tag) throw new NotFoundError('Tag')
  return { tag, posts: await site.listPublishedWithTag(tag.id), categories: await site.allCategories(), tags: await site.allTags() }
}

export async function searchPosts(db: DbInstance, rawQuery: string | null) {
  const query = rawQuery || ''
  if (!query) return { query, results: [] }
  return { query, results: await createPublicSiteRepository(db).searchPublishedByTitle(query, 50) }
}

/** A published post, or failing that a published static page with the same slug. Counts a view for posts. */
export async function getPostOrPage(db: DbInstance, slug: string) {
  const site = createPublicSiteRepository(db)
  const post = await site.findPostBySlug(slug)

  if (!post || post.status !== 'publish') {
    const page = await getPublishedPageBySlug(db, slug)
    if (!page) throw new NotFoundError('Page')
    return {
      kind: 'page' as const, page,
      popular: await getPopularPosts(db, 5), categories: await site.allCategories(), tags: await site.allTags(),
    }
  }

  const [comments, related, popular, postTags, authorName, postCategories, categories, tags] = await Promise.all([
    listCommentsByPost(db, post.id),
    site.relatedPublished(post.id, 3),
    site.popularPublished(5),
    site.tagsOfPost(post.id),
    site.authorName(post.authorId),
    site.categoriesOfPost(post.id),
    site.allCategories(),
    site.allTags(),
  ])
  await site.incrementViews(post.id)
  return {
    kind: 'post' as const,
    post: { ...post, content: sanitizeHtml(post.content) },
    comments, related, popular, tags, postTags, categories, authorName, postCategories,
  }
}

const FEED_LIMIT = 50

/** The RSS document for the newest posts (an empty feed when the site asks not to be indexed). */
export async function getRssFeed(db: DbInstance, requestOrigin: string): Promise<string> {
  const site = await getSite(db, requestOrigin)
  if (site.hidden) return rssXml(site, [])

  const repo = createPublicSiteRepository(db)
  const list = await repo.recentPublishedForFeed(FEED_LIMIT)
  const catsByPost = new Map<number, string[]>()
  if (list.length) {
    for (const c of await repo.categoryNamesByPost()) catsByPost.set(c.postId, [...(catsByPost.get(c.postId) ?? []), c.name])
  }

  return rssXml(site, list.map(p => ({
    title: p.title,
    link: `${site.origin}/${p.slug}`,
    description: p.excerpt ? snippet(stripHtml(p.excerpt), 300) : snippet(p.content, 300),
    contentHtml: sanitizeHtml(p.content),
    pubDate: parseStoredDate(p.publishedAt || p.createdAt),
    author: p.author,
    categories: catsByPost.get(p.id) ?? [],
  })))
}
