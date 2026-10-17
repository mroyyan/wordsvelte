import type { DbInstance } from '$lib/server/db'
import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { posts, pages, comments, media, categories, tags, users } from '@wordsvelte/shared'
import { ROLE_RANK, type AuthUser } from '$lib/server/auth'

export const MONTHS_IN_CHART = 12

export interface DashboardData {
  /** `own` for authors (their posts only), `site` for editors and admins. */
  scope: 'own' | 'site'
  totals: {
    posts: number
    published: number
    drafts: number
    pending: number
    scheduled: number
    /** Sum of the per-post view counters. There is no visitor tracking, so this is page views, not unique visitors. */
    views: number
    media: number
    pages?: number
    categories?: number
    tags?: number
    comments?: number
    pendingComments?: number
    users?: number
  }
  postsPerMonth: { month: string; count: number }[]
  /** Posts published this month vs the previous month. */
  monthDelta: { thisMonth: number; lastMonth: number; difference: number }
  topPosts: { id: number; title: string; slug: string; viewCount: number }[]
  recentPosts: { id: number; title: string; status: string; date: string; authorName: string | null }[]
  recentComments?: { id: number; authorName: string; content: string; status: string; createdAt: string; postTitle: string | null }[]
}

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/** The last `count` calendar months ending at `now`, oldest first, as YYYY-MM. */
export function lastMonths(now: Date, count = MONTHS_IN_CHART): string[] {
  const out: string[] = []
  for (let i = count - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))))
  return out
}

export async function getDashboard(db: DbInstance, user: Pick<AuthUser, 'userId' | 'role'>, now = new Date()): Promise<DashboardData> {
  const sitewide = ROLE_RANK[user.role] >= ROLE_RANK.editor
  const isAdmin = user.role === 'admin'
  const own = sitewide ? undefined : eq(posts.authorId, user.userId)
  const publishedDate = sql`COALESCE(${posts.publishedAt}, ${posts.createdAt})`

  const byStatus: { status: string; n: number }[] = await db.select({ status: posts.status, n: sql<number>`count(*)` }).from(posts).where(own).groupBy(posts.status)
  const count = (s: string) => Number(byStatus.find(r => r.status === s)?.n ?? 0)

  const [{ views }] = await db.select({ views: sql<number>`COALESCE(SUM(${posts.viewCount}), 0)` }).from(posts).where(and(own, eq(posts.status, 'publish')))

  const months = lastMonths(now)
  const rows: { month: string; n: number }[] = await db
    .select({ month: sql<string>`strftime('%Y-%m', ${publishedDate})`, n: sql<number>`count(*)` })
    .from(posts)
    .where(and(own, eq(posts.status, 'publish'), gte(publishedDate, `${months[0]}-01`)))
    .groupBy(sql`strftime('%Y-%m', ${publishedDate})`)
  const perMonth = new Map(rows.map(r => [r.month, Number(r.n)]))
  const postsPerMonth = months.map(month => ({ month, count: perMonth.get(month) ?? 0 }))
  const thisMonth = postsPerMonth.at(-1)!.count
  const lastMonth = postsPerMonth.at(-2)!.count

  const topPosts = await db.select({ id: posts.id, title: posts.title, slug: posts.slug, viewCount: posts.viewCount })
    .from(posts).where(and(own, eq(posts.status, 'publish'))).orderBy(desc(posts.viewCount), desc(posts.id)).limit(5)

  const recentPosts = await db.select({
    id: posts.id, title: posts.title, status: posts.status, date: publishedDate, authorName: users.displayName,
  }).from(posts).leftJoin(users, eq(users.id, posts.authorId)).where(own).orderBy(desc(publishedDate), desc(posts.id)).limit(5)

  const scalar = async (table: any, where?: any) => Number((await db.select({ n: sql<number>`count(*)` }).from(table).where(where))[0].n)

  const totals: DashboardData['totals'] = {
    posts: byStatus.reduce((sum, r) => sum + Number(r.n), 0),
    published: count('publish'),
    drafts: count('draft'),
    pending: count('pending'),
    scheduled: count('scheduled'),
    views: Number(views),
    media: await scalar(media, sitewide ? undefined : eq(media.uploadedBy, user.userId)),
  }

  const data: DashboardData = {
    scope: sitewide ? 'site' : 'own',
    totals,
    postsPerMonth,
    monthDelta: { thisMonth, lastMonth, difference: thisMonth - lastMonth },
    topPosts: topPosts.map((p: any) => ({ ...p, viewCount: Number(p.viewCount) })),
    recentPosts: recentPosts as DashboardData["recentPosts"],
  }

  if (sitewide) {
    totals.pages = await scalar(pages)
    totals.categories = await scalar(categories)
    totals.tags = await scalar(tags)
    totals.comments = await scalar(comments)
    totals.pendingComments = await scalar(comments, eq(comments.status, 'pending'))
    data.recentComments = await db.select({
      id: comments.id, authorName: comments.authorName, content: comments.content, status: comments.status, createdAt: comments.createdAt, postTitle: posts.title,
    }).from(comments).leftJoin(posts, eq(posts.id, comments.postId)).orderBy(desc(comments.createdAt), desc(comments.id)).limit(5)
  }
  if (isAdmin) totals.users = await scalar(users)

  return data
}
