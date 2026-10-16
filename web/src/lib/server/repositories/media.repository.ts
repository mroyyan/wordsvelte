import type { DbInstance } from '$lib/server/db'
import { eq, desc } from 'drizzle-orm'
import { media } from '@wordsvelte/shared'

export type MediaRow = typeof media.$inferSelect
export type NewMedia = typeof media.$inferInsert

export function createMediaRepository(db: DbInstance) {
  return {
    list(opts: { uploadedBy?: number } = {}): Promise<MediaRow[]> {
      const query = db.select().from(media)
      const filtered = opts.uploadedBy ? query.where(eq(media.uploadedBy, opts.uploadedBy)) : query
      return filtered.orderBy(desc(media.createdAt), desc(media.id))
    },

    async findById(id: number): Promise<MediaRow | null> {
      const [record] = await db.select().from(media).where(eq(media.id, id)).limit(1)
      return record ?? null
    },

    async insert(values: NewMedia): Promise<MediaRow> {
      const [record] = await db.insert(media).values(values).returning()
      return record
    },

    async delete(id: number): Promise<void> {
      await db.delete(media).where(eq(media.id, id))
    },
  }
}
