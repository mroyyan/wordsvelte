import { and, eq, gt, lt } from 'drizzle-orm'
import { passwordResets } from '@wordsvelte/shared'
import type { DbInstance } from '$lib/server/db'

export function createPasswordResetRepository(db: DbInstance) {
  return {
    /** Only the newest link works, and expired ones do not pile up. */
    async replaceForUser(userId: number, tokenHash: string, expiresAt: string, now: string): Promise<void> {
      await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
      await db.delete(passwordResets).where(lt(passwordResets.expiresAt, now))
      await db.insert(passwordResets).values({ userId, tokenHash, expiresAt })
    },

    async findValid(tokenHash: string, now: string) {
      const [row] = await db.select().from(passwordResets)
        .where(and(eq(passwordResets.tokenHash, tokenHash), gt(passwordResets.expiresAt, now))).limit(1)
      return row ?? null
    },

    async findByHash(tokenHash: string) {
      const [row] = await db.select().from(passwordResets).where(eq(passwordResets.tokenHash, tokenHash)).limit(1)
      return row ?? null
    },

    async deleteForUser(userId: number): Promise<void> {
      await db.delete(passwordResets).where(eq(passwordResets.userId, userId))
    },
  }
}

export type PasswordResetRepository = ReturnType<typeof createPasswordResetRepository>
