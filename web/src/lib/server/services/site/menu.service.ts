import { eq, asc, inArray } from 'drizzle-orm'
import { menus, menuItems, pages, toSlug } from '@wordsvelte/shared'
import { ValidationError, NotFoundError } from '$lib/server/core/errors'

interface CreateMenuData {
	name: string
	slug?: string
	location?: string
}

interface UpdateMenuData {
	name?: string
	location?: string
	status?: string
}

interface CreateMenuItemData {
	menuId: number
	label: string
	url?: string
	parentId?: number
	itemType?: string
	pageId?: number | null
	target?: string
	sortOrder?: number
}

interface UpdateMenuItemData {
	label?: string
	url?: string
	itemType?: string
	pageId?: number | null
	parentId?: number
	target?: string
	sortOrder?: number
	status?: string
}

const MENU_URL_RE = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i

/** Menu links end up in href attributes: only web, mail, phone, site-relative and anchor targets are allowed. */
export function validateMenuUrl(url: unknown): string | null {
	if (url === null || url === undefined || url === '') return null
	if (typeof url !== 'string' || url.length > 2048 || !MENU_URL_RE.test(url.trim())) {
		throw new ValidationError('URL must start with http(s)://, mailto:, tel:, / or #')
	}
	return url.trim()
}

/**
 * Items of type "page" store only a page id; the URL is derived from the page's current slug so renaming a page never
 * breaks a menu. `publicOnly` also drops items whose page is missing or not published (visitors must never get a dead link).
 */
export async function resolvePageLinks(db: any, items: any[], opts: { publicOnly?: boolean } = {}) {
	const ids = [...new Set(items.filter(i => i.itemType === 'page' && i.pageId).map(i => i.pageId as number))]
	const rows = ids.length ? await db.select({ id: pages.id, slug: pages.slug, title: pages.title, status: pages.status }).from(pages).where(inArray(pages.id, ids)) : []
	const byId = new Map<number, any>(rows.map((r: any) => [r.id, r]))

	const out: any[] = []
	for (const item of items) {
		if (item.itemType !== 'page') { out.push(item); continue }
		const page = item.pageId ? byId.get(item.pageId) : undefined
		if (opts.publicOnly && page?.status !== 'publish') continue
		out.push({ ...item, url: page ? `/${page.slug}` : null, pageTitle: page?.title ?? null, pageStatus: page?.status ?? 'missing' })
	}
	return out
}

async function requirePage(db: any, pageId: unknown) {
	const id = Number(pageId)
	if (!Number.isInteger(id)) throw new ValidationError('A page is required for page menu items')
	const [page] = await db.select().from(pages).where(eq(pages.id, id)).limit(1)
	if (!page) throw new NotFoundError('Page')
	return page
}

export async function listMenus(db: any) {
	const allMenus = await db.select().from(menus).orderBy(asc(menus.name))
	const result = []
	for (const menu of allMenus) {
		const items = await db.select().from(menuItems)
			.where(eq(menuItems.menuId, menu.id))
			.orderBy(asc(menuItems.sortOrder))
		result.push({ ...menu, items: await resolvePageLinks(db, items) })
	}
	return result
}

export async function createMenu(db: any, data: CreateMenuData) {
	if (!data.name) throw new ValidationError('Name required')

	const slug = data.slug || toSlug(data.name)
	const [menu] = await db.insert(menus).values({
		name: data.name,
		slug,
		location: data.location || 'header'
	}).returning()

	return { ...menu, items: [] }
}

export async function updateMenu(db: any, id: number, data: UpdateMenuData) {
	const updateData: any = {}
	if (data.name !== undefined) {
		updateData.name = data.name
		updateData.slug = toSlug(data.name)
	}
	if (data.location !== undefined) updateData.location = data.location
	if (data.status !== undefined) updateData.status = data.status
	updateData.updatedAt = new Date().toISOString()

	await db.update(menus).set(updateData).where(eq(menus.id, id))

	const [menu] = await db.select().from(menus).where(eq(menus.id, id)).limit(1)
	if (!menu) throw new NotFoundError('Menu')

	const items = await db.select().from(menuItems)
		.where(eq(menuItems.menuId, id))
		.orderBy(asc(menuItems.sortOrder))

	return { ...menu, items: await resolvePageLinks(db, items) }
}

export async function deleteMenu(db: any, id: number) {
	await db.delete(menuItems).where(eq(menuItems.menuId, id))
	await db.delete(menus).where(eq(menus.id, id))
}

export async function getMenuItems(db: any, menuId: number) {
	const items = await db.select().from(menuItems)
		.where(eq(menuItems.menuId, menuId))
		.orderBy(asc(menuItems.sortOrder))
	return resolvePageLinks(db, items)
}

export async function createMenuItem(db: any, data: CreateMenuItemData) {
	const [menu] = await db.select().from(menus).where(eq(menus.id, data.menuId)).limit(1)
	if (!menu) throw new NotFoundError('Menu')

	const isPage = data.itemType === 'page'
	const page = isPage ? await requirePage(db, data.pageId) : null
	const label = String(data.label || page?.title || '').trim()
	if (!label) throw new ValidationError('Label required')

	const count = await db.select({ count: menuItems.id }).from(menuItems).where(eq(menuItems.menuId, data.menuId))
	const sortOrder = data.sortOrder ?? (count?.length || 0)

	const [item] = await db.insert(menuItems).values({
		menuId: data.menuId,
		parentId: data.parentId ?? null,
		itemType: isPage ? 'page' : 'custom',
		pageId: page ? page.id : null,
		label,
		url: isPage ? null : validateMenuUrl(data.url),
		target: data.target || '_self',
		sortOrder
	}).returning()

	return (await resolvePageLinks(db, [item]))[0]
}

export async function updateMenuItem(db: any, id: number, data: UpdateMenuItemData) {
	const [existing] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1)
	if (!existing) throw new NotFoundError('Menu item')

	const updateData: any = {}
	if (data.label !== undefined) {
		if (!String(data.label).trim()) throw new ValidationError('Label required')
		updateData.label = String(data.label).trim()
	}
	if (data.parentId !== undefined) updateData.parentId = data.parentId
	if (data.target !== undefined) updateData.target = data.target
	if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
	if (data.status !== undefined) updateData.status = data.status

	const type = data.itemType ?? existing.itemType
	if (type === 'page') {
		const page = await requirePage(db, data.pageId ?? existing.pageId)
		updateData.itemType = 'page'
		updateData.pageId = page.id
		updateData.url = null
	} else {
		updateData.itemType = 'custom'
		updateData.pageId = null
		if (data.url !== undefined) updateData.url = validateMenuUrl(data.url)
	}

	await db.update(menuItems).set(updateData).where(eq(menuItems.id, id))
	const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1)
	return (await resolvePageLinks(db, [item]))[0]
}

export async function deleteMenuItem(db: any, id: number) {
	await db.delete(menuItems).where(eq(menuItems.id, id))
}

export async function getPublicMenus(db: any) {
	const allMenus = await db.select().from(menus)
		.where(eq(menus.status, 'active'))
		.orderBy(asc(menus.name))

	const result = []
	for (const menu of allMenus) {
		const items = await db.select().from(menuItems)
			.where(eq(menuItems.menuId, menu.id))
			.orderBy(asc(menuItems.sortOrder))
		const active = items.filter((i: any) => i.status === 'active')
		result.push({ ...menu, items: await resolvePageLinks(db, active, { publicOnly: true }) })
	}
	return result
}
