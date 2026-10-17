import { and, eq, gte, sql } from 'drizzle-orm'
import { postViews, posts } from '@wordsvelte/shared'
import type { DbInstance } from '$lib/server/db'

/** The day a view counts for: the UTC date, as YYYY-MM-DD. */
export const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/** Count one view of an article today. The insert-or-add is a single statement, so simultaneous readers never lose a count. */
export async function recordView(db: DbInstance, postId: number, now = new Date()): Promise<void> {
  await db.insert(postViews).values({ postId, day: dayKey(now), views: 1 })
    .onConflictDoUpdate({ target: [postViews.postId, postViews.day], set: { views: sql`${postViews.views} + 1` } })
}

export function createViewRepository(db: DbInstance) {
  return {
    record: (postId: number, now = new Date()) => recordView(db, postId, now),

    /** Views per day from `sinceDay` (inclusive) on, oldest first; days nobody read anything are simply absent. Optionally only one author's posts. */
    async perDay(sinceDay: string, authorId?: number): Promise<{ day: string; views: number }[]> {
      const base = db.select({ day: postViews.day, views: sql<number>`SUM(${postViews.views})` }).from(postViews)
      const rows = authorId === undefined
        ? await base.where(gte(postViews.day, sinceDay)).groupBy(postViews.day).orderBy(postViews.day)
        : await base.innerJoin(posts, eq(posts.id, postViews.postId)).where(and(gte(postViews.day, sinceDay), eq(posts.authorId, authorId))).groupBy(postViews.day).orderBy(postViews.day)
      return rows.map(r => ({ day: r.day, views: Number(r.views) }))
    },
  }
}

export type ViewRepository = ReturnType<typeof createViewRepository>
