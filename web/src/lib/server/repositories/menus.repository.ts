import type { DbInstance } from '$lib/server/db'
import { eq, asc, inArray } from 'drizzle-orm'
import { menus, menuItems, pages } from '@wordsvelte/shared'

export function createMenuRepository(db: DbInstance) {
	return {
		async listMenus(opts: { activeOnly?: boolean } = {}) {
			const q = db.select().from(menus)
			return (opts.activeOnly ? q.where(eq(menus.status, 'active')) : q).orderBy(asc(menus.name))
		},

		async findMenuById(id: number) {
			const [menu] = await db.select().from(menus).where(eq(menus.id, id)).limit(1)
			return menu ?? null
		},

		async insertMenu(values: { name: string; slug: string; location: string }) {
			const [menu] = await db.insert(menus).values(values).returning()
			return menu
		},

		async updateMenu(id: number, values: Record<string, unknown>) {
			await db.update(menus).set(values).where(eq(menus.id, id))
		},

		/** Removes the menu together with its items. */
		async deleteMenu(id: number) {
			await db.delete(menuItems).where(eq(menuItems.menuId, id))
			await db.delete(menus).where(eq(menus.id, id))
		},

		async listItems(menuId: number) {
			return db.select().from(menuItems)
				.where(eq(menuItems.menuId, menuId))
				.orderBy(asc(menuItems.sortOrder))
		},

		async countItems(menuId: number) {
			const rows = await db.select({ count: menuItems.id }).from(menuItems).where(eq(menuItems.menuId, menuId))
			return rows.length
		},

		async findItemById(id: number) {
			const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1)
			return item ?? null
		},

		async insertItem(values: {
			menuId: number
			parentId: number | null
			itemType: string
			pageId: number | null
			label: string
			url: string | null
			target: string
			sortOrder: number
		}) {
			const [item] = await db.insert(menuItems).values(values).returning()
			return item
		},

		async updateItem(id: number, values: Record<string, unknown>) {
			await db.update(menuItems).set(values).where(eq(menuItems.id, id))
		},

		async deleteItem(id: number) {
			await db.delete(menuItems).where(eq(menuItems.id, id))
		},

		/** Read-only page lookups used to resolve page-type menu items. */
		async findPageById(id: number) {
			const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1)
			return page ?? null
		},

		async findPageSummaries(ids: number[]) {
			if (!ids.length) return []
			return db.select({ id: pages.id, slug: pages.slug, title: pages.title, status: pages.status })
				.from(pages).where(inArray(pages.id, ids))
		}
	}
}
