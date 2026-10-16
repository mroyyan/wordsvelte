import type { DbInstance } from '$lib/server/db'
import { eq, desc, asc, and, sql } from 'drizzle-orm'
import { posts, postCategories, postTags, categories, tags } from '@wordsvelte/shared'

export type PostRow = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
export type PostPatch = Partial<NewPost>

export interface PostListFilter {
  status?: string
  authorId?: number
  search?: string
  categoryId?: number
  limit: number
  offset: number
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => '\\' + c)

const sortDate = sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`

export function createPostRepository(db: DbInstance) {
  const featuredPublished = () => and(eq(posts.isFeatured, true), eq(posts.status, 'publish'))

  return {
    async list(filter: PostListFilter): Promise<{ rows: PostRow[]; total: number }> {
      const conditions = []
      if (filter.status) conditions.push(eq(posts.status, filter.status))
      if (filter.authorId) conditions.push(eq(posts.authorId, filter.authorId))
      if (filter.search) conditions.push(sql`${posts.title} LIKE ${'%' + escapeLike(filter.search) + '%'} ESCAPE '\\'`)
      if (filter.categoryId) conditions.push(sql`EXISTS (SELECT 1 FROM post_categories WHERE post_id = ${posts.id} AND category_id = ${filter.categoryId})`)
      const where = conditions.length ? and(...conditions) : undefined

      const { total } = await db.select({ total: sql<number>`count(*)` }).from(posts).where(where).then(r => r[0])
      const rows = await db.select().from(posts).where(where)
        .orderBy(desc(sortDate), desc(posts.id))
        .limit(filter.limit).offset(filter.offset)
      return { rows, total }
    },

    async findById(id: number): Promise<PostRow | null> {
      const [post] = await db.select().from(posts).where(eq(posts.id, id)).limit(1)
      return post ?? null
    },

    async findBySlug(slug: string): Promise<PostRow | null> {
      const [post] = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1)
      return post ?? null
    },

    async exists(id: number): Promise<boolean> {
      const [row] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, id)).limit(1)
      return !!row
    },

    listCategoriesWithSlug(postId: number) {
      return db.select({ id: categories.id, name: categories.name, slug: categories.slug })
        .from(postCategories).innerJoin(categories, eq(postCategories.categoryId, categories.id))
        .where(eq(postCategories.postId, postId))
    },

    listTagsWithSlug(postId: number) {
      return db.select({ id: tags.id, name: tags.name, slug: tags.slug })
        .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id))
        .where(eq(postTags.postId, postId))
    },

    listCategoryNames(postId: number) {
      return db.select({ id: categories.id, name: categories.name })
        .from(postCategories).innerJoin(categories, eq(postCategories.categoryId, categories.id))
        .where(eq(postCategories.postId, postId))
    },

    listTagNames(postId: number) {
      return db.select({ id: tags.id, name: tags.name })
        .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id))
        .where(eq(postTags.postId, postId))
    },

    async insert(values: NewPost): Promise<PostRow> {
      const [post] = await db.insert(posts).values(values).returning()
      return post
    },

    async update(id: number, patch: PostPatch): Promise<void> {
      await db.update(posts).set(patch).where(eq(posts.id, id))
    },

    async delete(id: number): Promise<void> {
      await db.delete(posts).where(eq(posts.id, id))
    },

    async incrementViews(id: number): Promise<void> {
      await db.update(posts).set({ viewCount: sql`${posts.viewCount} + 1` }).where(eq(posts.id, id))
    },

    async insertCategoryLinks(postId: number, categoryIds: number[]): Promise<void> {
      if (categoryIds.length) await db.insert(postCategories).values(categoryIds.map(categoryId => ({ postId, categoryId })))
    },

    async insertTagLinks(postId: number, tagIds: number[]): Promise<void> {
      if (tagIds.length) await db.insert(postTags).values(tagIds.map(tagId => ({ postId, tagId })))
    },

    async deleteCategoryLinks(postId: number): Promise<void> {
      await db.delete(postCategories).where(eq(postCategories.postId, postId))
    },

    async deleteTagLinks(postId: number): Promise<void> {
      await db.delete(postTags).where(eq(postTags.postId, postId))
    },

    listRelated(postId: number, limit: number) {
      return db.select().from(posts)
        .where(and(
          eq(posts.status, 'publish'),
          sql`${posts.id} != ${postId}`,
          sql`EXISTS (SELECT 1 FROM post_categories pc1 WHERE pc1.post_id = ${posts.id} AND pc1.category_id IN (SELECT pc2.category_id FROM post_categories pc2 WHERE pc2.post_id = ${postId}))`,
        ))
        .orderBy(sql`RANDOM()`).limit(limit)
    },

    listPopular(limit: number) {
      return db.select().from(posts)
        .where(eq(posts.status, 'publish'))
        .orderBy(desc(posts.viewCount))
        .limit(limit)
    },

    listFeatured(limit: number) {
      return db.select().from(posts)
        .where(featuredPublished())
        .orderBy(desc(sortDate))
        .limit(limit)
    },

    async countFeatured(): Promise<number> {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(posts).where(featuredPublished())
      return count
    },

    async isFeaturedPublished(id: number): Promise<boolean> {
      const [row] = await db.select({ id: posts.id }).from(posts).where(and(featuredPublished(), eq(posts.id, id))).limit(1)
      return !!row
    },

    /** Oldest featured published posts, excluding `exceptId`. */
    async listOldestFeaturedIds(exceptId: number, limit: number): Promise<number[]> {
      const rows = await db.select({ id: posts.id }).from(posts)
        .where(and(featuredPublished(), sql`${posts.id} != ${exceptId}`))
        .orderBy(asc(sortDate), asc(posts.id))
        .limit(limit)
      return rows.map(r => r.id)
    },

    async unfeature(id: number): Promise<void> {
      await db.update(posts).set({ isFeatured: false }).where(eq(posts.id, id))
    },

    async setFeatured(id: number, isFeatured: boolean, updatedAt: string): Promise<void> {
      await db.update(posts).set({ isFeatured, updatedAt }).where(eq(posts.id, id))
    },
  }
}
