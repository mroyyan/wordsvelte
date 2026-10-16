import { and, desc, eq, isNull, lt, ne, or, sql } from 'drizzle-orm'
import { users } from '@wordsvelte/shared'
import type { DbInstance } from '$lib/server/db'

export type UserRow = typeof users.$inferSelect
export type NewUser = Pick<typeof users.$inferInsert, 'email' | 'username' | 'passwordHash' | 'displayName' | 'role'>
export type UserPatch = Partial<Pick<UserRow, 'displayName' | 'email' | 'role' | 'avatarUrl'>>

/** Everything about a user that is safe to show; never the password hash or two-factor secrets. */
const publicColumns = {
  id: users.id,
  email: users.email,
  username: users.username,
  displayName: users.displayName,
  role: users.role,
  avatarUrl: users.avatarUrl,
  createdAt: users.createdAt,
}

const nowIso = () => new Date().toISOString()
const bumpSessions = sql`${users.sessionVersion} + 1`

export function createUserRepository(db: DbInstance) {
  return {
    async findById(id: number): Promise<UserRow | null> {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
      return row ?? null
    },

    async findByEmail(email: string): Promise<UserRow | null> {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
      return row ?? null
    },

    async findPublicById(id: number) {
      const [row] = await db.select(publicColumns).from(users).where(eq(users.id, id)).limit(1)
      return row ?? null
    },

    async emailTaken(email: string, exceptId?: number): Promise<boolean> {
      const where = exceptId === undefined ? eq(users.email, email) : and(eq(users.email, email), ne(users.id, exceptId))
      const [row] = await db.select({ id: users.id }).from(users).where(where).limit(1)
      return !!row
    },

    async usernameTaken(username: string): Promise<boolean> {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1)
      return !!row
    },

    async hasAny(): Promise<boolean> {
      const [row] = await db.select({ id: users.id }).from(users).limit(1)
      return !!row
    },

    async minId(): Promise<number | null> {
      const [row] = await db.select({ minId: sql<number | null>`min(${users.id})` }).from(users)
      return row?.minId ?? null
    },

    async count(): Promise<number> {
      const [row] = await db.select({ count: sql<number>`count(*)` }).from(users)
      return Number(row.count)
    },

    listPublic(limit: number, offset: number) {
      return db.select(publicColumns).from(users).orderBy(desc(users.createdAt), desc(users.id)).limit(limit).offset(offset)
    },

    async insert(values: NewUser): Promise<UserRow> {
      const [row] = await db.insert(users).values(values).returning()
      return row
    },

    async deleteById(id: number): Promise<void> {
      await db.delete(users).where(eq(users.id, id))
    },

    async update(id: number, patch: UserPatch): Promise<void> {
      await db.update(users).set({ ...patch, updatedAt: nowIso() }).where(eq(users.id, id))
    },

    /** New password hash; the session version moves on, which signs the account out everywhere else. */
    async setPassword(id: number, passwordHash: string, at = nowIso()): Promise<void> {
      await db.update(users).set({ passwordHash, sessionVersion: bumpSessions, updatedAt: at }).where(eq(users.id, id))
    },

    // ---- two-factor ----

    /** Store a freshly generated (not yet confirmed) authenticator seed. */
    async startTotp(id: number, sealedSecret: string): Promise<void> {
      await db.update(users).set({ totpSecret: sealedSecret, totpLastStep: null }).where(eq(users.id, id))
    },

    async enableTotp(id: number): Promise<void> {
      await db.update(users).set({ totpEnabled: true }).where(eq(users.id, id))
    },

    async clearTotp(id: number): Promise<void> {
      await db.update(users).set({ totpEnabled: false, totpSecret: null, totpLastStep: null, sessionVersion: bumpSessions }).where(eq(users.id, id))
    },

    /**
     * Remember the newest accepted TOTP step. The guarded update makes replay protection atomic: of two concurrent
     * requests carrying the same code only one gets `true`.
     */
    async claimTotpStep(id: number, step: number): Promise<boolean> {
      const rows = await db.update(users).set({ totpLastStep: step })
        .where(and(eq(users.id, id), or(isNull(users.totpLastStep), lt(users.totpLastStep, step)))).returning({ id: users.id })
      return rows.length === 1
    },

    async enableEmail2fa(id: number): Promise<void> {
      await db.update(users).set({ email2faEnabled: true }).where(eq(users.id, id))
    },

    async disableEmail2fa(id: number): Promise<void> {
      await db.update(users).set({ email2faEnabled: false, sessionVersion: bumpSessions }).where(eq(users.id, id))
    },
  }
}

export type UserRepository = ReturnType<typeof createUserRepository>
