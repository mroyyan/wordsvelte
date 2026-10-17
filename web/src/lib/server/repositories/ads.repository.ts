import { and, asc, eq, isNull, lte, gt, or, sql } from 'drizzle-orm'
import { ads } from '@wordsvelte/shared'
import type { DbInstance } from '$lib/server/db'

export type AdRow = typeof ads.$inferSelect
export type NewAd = typeof ads.$inferInsert
export type AdPatch = Partial<Omit<NewAd, 'id' | 'createdAt' | 'clicks'>>

export function createAdRepository(db: DbInstance) {
  return {
    list() {
      return db.select().from(ads).orderBy(asc(ads.placement), asc(ads.sortOrder), asc(ads.id))
    },

    async findById(id: number): Promise<AdRow | null> {
      const [row] = await db.select().from(ads).where(eq(ads.id, id)).limit(1)
      return row ?? null
    },

    async insert(values: NewAd): Promise<AdRow> {
      const [row] = await db.insert(ads).values(values).returning()
      return row
    },

    async update(id: number, patch: AdPatch): Promise<void> {
      await db.update(ads).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(ads.id, id))
    },

    async delete(id: number): Promise<void> {
      await db.delete(ads).where(eq(ads.id, id))
    },

    /** Active ads whose run window includes `nowIso`, in display order. */
    listRunning(nowIso: string) {
      return db.select().from(ads)
        .where(and(eq(ads.status, 'active'), or(isNull(ads.startsAt), lte(ads.startsAt, nowIso)), or(isNull(ads.endsAt), gt(ads.endsAt, nowIso))))
        .orderBy(asc(ads.sortOrder), asc(ads.id))
    },

    async incrementClicks(id: number): Promise<void> {
      await db.update(ads).set({ clicks: sql`${ads.clicks} + 1` }).where(eq(ads.id, id))
    },
  }
}

export type AdRepository = ReturnType<typeof createAdRepository>
