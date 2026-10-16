import type { DbInstance } from '$lib/server/db'
import { eq, inArray } from 'drizzle-orm'
import { categories } from '@wordsvelte/shared'

export type CategoryRow = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type CategoryPatch = Partial<NewCategory>

export function createCategoryRepository(db: DbInstance) {
  return {
    list(): Promise<CategoryRow[]> {
      return db.select().from(categories).orderBy(categories.name)
    },

    async findById(id: number): Promise<CategoryRow | null> {
      const [cat] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
      return cat ?? null
    },

    async slugExists(slug: string): Promise<boolean> {
      const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1)
      return !!row
    },

    /** How many of `ids` exist. */
    async countExisting(ids: number[]): Promise<number> {
      const rows = await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, ids))
      return rows.length
    },

    async insert(values: NewCategory): Promise<CategoryRow> {
      const [cat] = await db.insert(categories).values(values).returning()
      return cat
    },

    async update(id: number, patch: CategoryPatch): Promise<void> {
      await db.update(categories).set(patch).where(eq(categories.id, id))
    },

    async delete(id: number): Promise<void> {
      await db.delete(categories).where(eq(categories.id, id))
    },
  }
}
