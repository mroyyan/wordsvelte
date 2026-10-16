import type { DbInstance } from '$lib/server/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { pages } from '@wordsvelte/shared'

export type PageRow = typeof pages.$inferSelect
export type NewPage = typeof pages.$inferInsert
export type PagePatch = Partial<NewPage>

export function createPageRepository(db: DbInstance) {
  return {
    list(status?: 'draft' | 'publish'): Promise<PageRow[]> {
      const where = status ? eq(pages.status, status) : undefined
      return db.select().from(pages).where(where).orderBy(desc(sql`COALESCE(${pages.publishedAt}, ${pages.createdAt})`), desc(pages.id))
    },

    async findById(id: number): Promise<PageRow | null> {
      const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1)
      return page ?? null
    },

    async findPublishedBySlug(slug: string): Promise<PageRow | null> {
      const [page] = await db.select().from(pages).where(and(eq(pages.slug, slug), eq(pages.status, 'publish'))).limit(1)
      return page ?? null
    },

    async insert(values: NewPage): Promise<PageRow> {
      const [page] = await db.insert(pages).values(values).returning()
      return page
    },

    async update(id: number, patch: PagePatch): Promise<void> {
      await db.update(pages).set(patch).where(eq(pages.id, id))
    },

    async delete(id: number): Promise<void> {
      await db.delete(pages).where(eq(pages.id, id))
    },
  }
}
