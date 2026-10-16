import { eq, inArray } from 'drizzle-orm'
import { settings } from '@wordsvelte/shared'
import type { DbInstance } from '$lib/server/db'

/** Raw key/value rows. What may be read or written, and by whom, is decided by the settings service, not here. */
export function createSettingsRepository(db: DbInstance) {
  return {
    all() {
      return db.select().from(settings)
    },

    async get(key: string): Promise<string | null> {
      const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
      return row?.value ?? null
    },

    getMany(keys: string[]) {
      return db.select().from(settings).where(inArray(settings.key, keys))
    },

    async upsert(key: string, value: string): Promise<void> {
      await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } })
    },

    /** Used where two requests may race to create the same row (first writer wins). */
    async insertIfAbsent(key: string, value: string): Promise<void> {
      await db.insert(settings).values({ key, value }).onConflictDoNothing()
    },

    async deleteMany(keys: string[]): Promise<void> {
      await db.delete(settings).where(inArray(settings.key, keys))
    },
  }
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>
