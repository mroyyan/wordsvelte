import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { categories, postCategories, postTags, posts, tags, users, widgets } from '@wordsvelte/shared'
import type { DbInstance } from '$lib/server/db'

const publishedAtOrCreated = sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`

/** `%`, `_` and `\` typed by a reader are literal characters, not wildcards. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => '\\' + c)

/** Read-only queries behind the public website (home, archives, search, single posts, feed). */
export function createPublicSiteRepository(db: DbInstance) {
  const published = eq(posts.status, 'publish')

  return {
    activeWidgets() {
      return db.select().from(widgets).where(eq(widgets.status, 'active')).orderBy(asc(widgets.sortOrder))
    },

    allCategories() {
      return db.select().from(categories).orderBy(asc(categories.name))
    },

    allTags() {
      return db.select().from(tags).orderBy(asc(tags.name))
    },

    async findCategoryBySlug(slug: string) {
      const [row] = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1)
      return row ?? null
    },

    async findTagBySlug(slug: string) {
      const [row] = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1)
      return row ?? null
    },

    async countPublished(): Promise<number> {
      const [row] = await db.select({ total: sql<number>`count(*)` }).from(posts).where(published)
      return Number(row.total)
    },

    listPublished(limit: number, offset: number) {
      return db.select().from(posts).where(published).orderBy(desc(publishedAtOrCreated)).limit(limit).offset(offset)
    },

    async listPublishedInCategory(categoryId: number) {
      const rows = await db.select({ post: posts }).from(posts)
        .innerJoin(postCategories, eq(postCategories.postId, posts.id))
        .where(and(eq(postCategories.categoryId, categoryId), published)).orderBy(desc(posts.publishedAt))
      return rows.map(r => r.post)
    },

    async listPublishedWithTag(tagId: number) {
      const rows = await db.select({ post: posts }).from(posts)
        .innerJoin(postTags, eq(postTags.postId, posts.id))
        .where(and(eq(postTags.tagId, tagId), published)).orderBy(desc(posts.publishedAt))
      return rows.map(r => r.post)
    },

    searchPublishedByTitle(query: string, limit: number) {
      return db.select().from(posts)
        .where(and(published, sql`${posts.title} LIKE ${'%' + escapeLike(query) + '%'} ESCAPE '\\'`))
        .orderBy(desc(posts.publishedAt)).limit(limit)
    },

    async findPostBySlug(slug: string) {
      const [row] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1)
      return row ?? null
    },

    relatedPublished(excludePostId: number, limit: number) {
      return db.select().from(posts).where(and(ne(posts.id, excludePostId), published)).orderBy(sql`RANDOM()`).limit(limit)
    },

    popularPublished(limit: number) {
      return db.select().from(posts).where(published).orderBy(desc(posts.viewCount)).limit(limit)
    },

    tagsOfPost(postId: number) {
      return db.select({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id)).where(eq(postTags.postId, postId))
    },

    categoriesOfPost(postId: number) {
      return db.select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(postCategories).innerJoin(categories, eq(postCategories.categoryId, categories.id)).where(eq(postCategories.postId, postId))
    },

    async authorName(userId: number): Promise<string | null> {
      const [row] = await db.select({ name: users.displayName }).from(users).where(eq(users.id, userId)).limit(1)
      return row?.name ?? null
    },

    async incrementViews(postId: number): Promise<void> {
      await db.update(posts).set({ viewCount: sql`view_count + 1` }).where(eq(posts.id, postId))
    },

    recentPublishedForFeed(limit: number) {
      return db.select({
        id: posts.id, title: posts.title, slug: posts.slug, excerpt: posts.excerpt, content: posts.content,
        publishedAt: posts.publishedAt, createdAt: posts.createdAt, author: users.displayName,
      }).from(posts).leftJoin(users, eq(users.id, posts.authorId))
        .where(published)
        .orderBy(desc(publishedAtOrCreated), desc(posts.id))
        .limit(limit)
    },

    /** The alphabetically first category of each given post (what the home page shows as its label). */
    async firstCategoryNames(postIds: number[]): Promise<Map<number, string>> {
      const out = new Map<number, string>()
      for (let i = 0; i < postIds.length; i += 50) {
        const rows = await db.select({ postId: postCategories.postId, name: categories.name })
          .from(postCategories).innerJoin(categories, eq(categories.id, postCategories.categoryId))
          .where(inArray(postCategories.postId, postIds.slice(i, i + 50))).orderBy(desc(categories.name))
        // ordered Z..A, so the last write per post is the alphabetically first name
        for (const r of rows) out.set(r.postId, r.name)
      }
      return out
    },

    categoryNamesByPost() {
      return db.select({ postId: postCategories.postId, name: categories.name })
        .from(postCategories).innerJoin(categories, eq(categories.id, postCategories.categoryId))
    },
  }
}

export type PublicSiteRepository = ReturnType<typeof createPublicSiteRepository>
