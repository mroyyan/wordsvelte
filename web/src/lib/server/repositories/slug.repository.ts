import type { DbInstance } from '$lib/server/db'
import { eq } from 'drizzle-orm'
import { posts, pages } from '@wordsvelte/shared'

export function createSlugRepository(db: DbInstance) {
  return {
    async findPostIdBySlug(slug: string): Promise<number | null> {
      const [row] = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1)
      return row ? row.id : null
    },
    async findPageIdBySlug(slug: string): Promise<number | null> {
      const [row] = await db.select({ id: pages.id }).from(pages).where(eq(pages.slug, slug)).limit(1)
      return row ? row.id : null
    },
  }
}
