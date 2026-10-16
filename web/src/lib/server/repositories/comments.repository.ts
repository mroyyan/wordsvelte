import type { DbInstance } from '$lib/server/db'
import { eq, desc, sql, and } from 'drizzle-orm'
import { comments } from '@wordsvelte/shared'

export type CommentRow = typeof comments.$inferSelect
export type NewComment = typeof comments.$inferInsert

/** Columns safe to show on the public site: never the commenter's email. */
const publicColumns = {
  id: comments.id,
  postId: comments.postId,
  authorName: comments.authorName,
  content: comments.content,
  parentId: comments.parentId,
  createdAt: comments.createdAt,
}

export function createCommentRepository(db: DbInstance) {
  return {
    listApprovedByPost(postId: number) {
      return db.select(publicColumns).from(comments)
        .where(and(eq(comments.postId, postId), eq(comments.status, 'approved')))
        .orderBy(desc(comments.createdAt))
    },

    async list(opts: { status?: string; limit: number; offset: number }): Promise<{ rows: CommentRow[]; total: number }> {
      const where = opts.status ? eq(comments.status, opts.status) : undefined
      const total = await db.select({ count: sql<number>`count(*)` }).from(comments).where(where).then(r => r[0].count)
      const rows = await db.select().from(comments).where(where).orderBy(desc(comments.createdAt), desc(comments.id)).limit(opts.limit).offset(opts.offset)
      return { rows, total }
    },

    async findById(id: number): Promise<CommentRow | null> {
      const [comment] = await db.select().from(comments).where(eq(comments.id, id)).limit(1)
      return comment ?? null
    },

    async insert(values: NewComment): Promise<CommentRow> {
      const [comment] = await db.insert(comments).values(values).returning()
      return comment
    },

    async updateStatus(id: number, status: string): Promise<void> {
      await db.update(comments).set({ status }).where(eq(comments.id, id))
    },

    async delete(id: number): Promise<void> {
      await db.delete(comments).where(eq(comments.id, id))
    },
  }
}
