import type { DbInstance } from '$lib/server/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { media } from '@wordsvelte/shared'

export type MediaRow = typeof media.$inferSelect
export type NewMedia = typeof media.$inferInsert

/** `%`, `_` and `\` typed in a search box are literal characters, not wildcards. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, c => '\\' + c)

export interface MediaListFilter { uploadedBy?: number; search?: string; limit: number; offset: number }

export function createMediaRepository(db: DbInstance) {
  return {
    /** One page of files, newest first, with the total number of files that match. */
    async list(filter: MediaListFilter): Promise<{ rows: MediaRow[]; total: number }> {
      const conditions = []
      if (filter.uploadedBy) conditions.push(eq(media.uploadedBy, filter.uploadedBy))
      if (filter.search) conditions.push(sql`${media.originalName} LIKE ${'%' + escapeLike(filter.search) + '%'} ESCAPE '\\'`)
      const where = conditions.length ? and(...conditions) : undefined

      const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(media).where(where)
      const rows = await db.select().from(media).where(where).orderBy(desc(media.createdAt), desc(media.id)).limit(filter.limit).offset(filter.offset)
      return { rows, total: Number(total) }
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
