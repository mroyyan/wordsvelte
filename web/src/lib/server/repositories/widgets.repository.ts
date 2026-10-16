import type { DbInstance } from '$lib/server/db'
import { eq, asc } from 'drizzle-orm'
import { widgets } from '@wordsvelte/shared'

export function createWidgetRepository(db: DbInstance) {
	return {
		async list(opts: { activeOnly?: boolean } = {}) {
			const q = db.select().from(widgets)
			return (opts.activeOnly ? q.where(eq(widgets.status, 'active')) : q).orderBy(asc(widgets.sortOrder))
		},

		async findById(id: number) {
			const [item] = await db.select().from(widgets).where(eq(widgets.id, id)).limit(1)
			return item ?? null
		},

		async insert(values: {
			widgetType: string
			title: string | null
			content: string | null
			settings: any
			sidebarArea: string
			sortOrder: number
		}) {
			const [item] = await db.insert(widgets).values(values).returning()
			return item
		},

		async update(id: number, values: Record<string, unknown>) {
			await db.update(widgets).set(values).where(eq(widgets.id, id))
		},

		async delete(id: number) {
			await db.delete(widgets).where(eq(widgets.id, id))
		}
	}
}
