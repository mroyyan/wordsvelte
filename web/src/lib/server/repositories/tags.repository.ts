import type { DbInstance } from '$lib/server/db'
import { eq, inArray } from 'drizzle-orm'
import { tags } from '@wordsvelte/shared'

export type TagRow = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export function createTagRepository(db: DbInstance) {
  return {
    list(): Promise<TagRow[]> {
      return db.select().from(tags).orderBy(tags.name)
    },

    async findById(id: number): Promise<TagRow | null> {
      const [tag] = await db.select().from(tags).where(eq(tags.id, id)).limit(1)
      return tag ?? null
    },

    async slugExists(slug: string): Promise<boolean> {
      const [row] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).limit(1)
      return !!row
    },

    /** How many of `ids` exist. */
    async countExisting(ids: number[]): Promise<number> {
      const rows = await db.select({ id: tags.id }).from(tags).where(inArray(tags.id, ids))
      return rows.length
    },

    async insert(values: NewTag): Promise<TagRow> {
      const [tag] = await db.insert(tags).values(values).returning()
      return tag
    },

    async updateName(id: number, name: string | undefined): Promise<void> {
      await db.update(tags).set({ name }).where(eq(tags.id, id))
    },

    async delete(id: number): Promise<void> {
      await db.delete(tags).where(eq(tags.id, id))
    },
  }
}
