import type { DbInstance } from '$lib/server/db'
import { toSlug } from '@wordsvelte/shared'
import { createMenuRepository } from '$lib/server/repositories/menus.repository'
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
export async function resolvePageLinks(db: DbInstance, items: any[], opts: { publicOnly?: boolean } = {}) {
	const ids = [...new Set(items.filter(i => i.itemType === 'page' && i.pageId).map(i => i.pageId as number))]
	const rows = await createMenuRepository(db).findPageSummaries(ids)
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

async function requirePage(db: DbInstance, pageId: unknown) {
	const id = Number(pageId)
	if (!Number.isInteger(id)) throw new ValidationError('A page is required for page menu items')
	const page = await createMenuRepository(db).findPageById(id)
	if (!page) throw new NotFoundError('Page')
	return page
}

export async function listMenus(db: DbInstance) {
	const menus = createMenuRepository(db)
	const result = []
	for (const menu of await menus.listMenus()) {
		result.push({ ...menu, items: await resolvePageLinks(db, await menus.listItems(menu.id)) })
	}
	return result
}

export async function createMenu(db: DbInstance, data: CreateMenuData) {
	if (!data.name) throw new ValidationError('Name required')

	const slug = data.slug || toSlug(data.name)
	const menu = await createMenuRepository(db).insertMenu({
		name: data.name,
		slug,
		location: data.location || 'header'
	})

	return { ...menu, items: [] }
}

export async function updateMenu(db: DbInstance, id: number, data: UpdateMenuData) {
	const menus = createMenuRepository(db)
	const updateData: any = {}
	if (data.name !== undefined) {
		updateData.name = data.name
		updateData.slug = toSlug(data.name)
	}
	if (data.location !== undefined) updateData.location = data.location
	if (data.status !== undefined) updateData.status = data.status
	updateData.updatedAt = new Date().toISOString()

	await menus.updateMenu(id, updateData)

	const menu = await menus.findMenuById(id)
	if (!menu) throw new NotFoundError('Menu')

	return { ...menu, items: await resolvePageLinks(db, await menus.listItems(id)) }
}

export async function deleteMenu(db: DbInstance, id: number) {
	await createMenuRepository(db).deleteMenu(id)
}

export async function getMenuItems(db: DbInstance, menuId: number) {
	return resolvePageLinks(db, await createMenuRepository(db).listItems(menuId))
}

export async function createMenuItem(db: DbInstance, data: CreateMenuItemData) {
	const menus = createMenuRepository(db)
	if (!(await menus.findMenuById(data.menuId))) throw new NotFoundError('Menu')

	const isPage = data.itemType === 'page'
	const page = isPage ? await requirePage(db, data.pageId) : null
	const label = String(data.label || page?.title || '').trim()
	if (!label) throw new ValidationError('Label required')

	const sortOrder = data.sortOrder ?? await menus.countItems(data.menuId)

	const item = await menus.insertItem({
		menuId: data.menuId,
		parentId: data.parentId ?? null,
		itemType: isPage ? 'page' : 'custom',
		pageId: page ? page.id : null,
		label,
		url: isPage ? null : validateMenuUrl(data.url),
		target: data.target || '_self',
		sortOrder
	})

	return (await resolvePageLinks(db, [item]))[0]
}

export async function updateMenuItem(db: DbInstance, id: number, data: UpdateMenuItemData) {
	const menus = createMenuRepository(db)
	const existing = await menus.findItemById(id)
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

	await menus.updateItem(id, updateData)
	const item = await menus.findItemById(id)
	return (await resolvePageLinks(db, [item]))[0]
}

export async function deleteMenuItem(db: DbInstance, id: number) {
	await createMenuRepository(db).deleteItem(id)
}

export async function getPublicMenus(db: DbInstance) {
	const menus = createMenuRepository(db)
	const result = []
	for (const menu of await menus.listMenus({ activeOnly: true })) {
		const active = (await menus.listItems(menu.id)).filter((i: any) => i.status === 'active')
		result.push({ ...menu, items: await resolvePageLinks(db, active, { publicOnly: true }) })
	}
	return result
}
