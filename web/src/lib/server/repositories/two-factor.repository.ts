import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm'
import { recoveryCodes, twoFactorCodes } from '@wordsvelte/shared'
import type { DbInstance } from '$lib/server/db'

export type EmailCodePurpose = 'login' | 'enable'

/** Persistence for the one-time codes that back two-factor sign-in: recovery codes and emailed codes. */
export function createTwoFactorRepository(db: DbInstance) {
  return {
    // ---- recovery codes ----
    async replaceRecoveryCodes(userId: number, codeHashes: string[]): Promise<void> {
      await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId))
      for (const codeHash of codeHashes) await db.insert(recoveryCodes).values({ userId, codeHash })
    },

    async countRecoveryCodes(userId: number, opts: { unusedOnly?: boolean } = {}): Promise<number> {
      const where = opts.unusedOnly ? and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)) : eq(recoveryCodes.userId, userId)
      const [row] = await db.select({ n: sql<number>`count(*)` }).from(recoveryCodes).where(where)
      return Number(row.n)
    },

    unusedRecoveryCodes(userId: number) {
      return db.select().from(recoveryCodes).where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)))
    },

    /** Guarded so that two requests racing with the same code cannot both succeed. */
    async markRecoveryCodeUsed(id: number): Promise<boolean> {
      const rows = await db.update(recoveryCodes).set({ usedAt: new Date().toISOString() })
        .where(and(eq(recoveryCodes.id, id), isNull(recoveryCodes.usedAt))).returning({ id: recoveryCodes.id })
      return rows.length === 1
    },

    async deleteRecoveryCodes(userId: number): Promise<void> {
      await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId))
    },

    // ---- emailed codes ----
    /** One live code per user and purpose: issuing a new one replaces the old, and expired rows are swept. */
    async replaceEmailCode(userId: number, purpose: EmailCodePurpose, codeHash: string, expiresAt: string, now: string): Promise<void> {
      await db.delete(twoFactorCodes).where(and(eq(twoFactorCodes.userId, userId), eq(twoFactorCodes.purpose, purpose)))
      await db.delete(twoFactorCodes).where(lt(twoFactorCodes.expiresAt, now))
      await db.insert(twoFactorCodes).values({ userId, purpose, codeHash, expiresAt })
    },

    async latestEmailCode(userId: number, purpose: EmailCodePurpose) {
      const [row] = await db.select().from(twoFactorCodes)
        .where(and(eq(twoFactorCodes.userId, userId), eq(twoFactorCodes.purpose, purpose))).orderBy(desc(twoFactorCodes.id)).limit(1)
      return row ?? null
    },

    async recordFailedEmailCodeAttempt(id: number): Promise<void> {
      await db.update(twoFactorCodes).set({ attempts: sql`${twoFactorCodes.attempts} + 1` }).where(eq(twoFactorCodes.id, id))
    },

    /** Single use, even under concurrent requests. */
    async consumeEmailCode(id: number): Promise<boolean> {
      const rows = await db.delete(twoFactorCodes).where(eq(twoFactorCodes.id, id)).returning({ id: twoFactorCodes.id })
      return rows.length === 1
    },

    async deleteEmailCodes(userId: number): Promise<void> {
      await db.delete(twoFactorCodes).where(eq(twoFactorCodes.userId, userId))
    },
  }
}

export type TwoFactorRepository = ReturnType<typeof createTwoFactorRepository>
