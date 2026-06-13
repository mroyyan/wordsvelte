import { eq, asc } from 'drizzle-orm'
import { menus, menuItems, toSlug } from '@wordsvelte/shared'
import { ValidationError, NotFoundError } from '$lib/server/errors'

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
	target?: string
	sortOrder?: number
}

interface UpdateMenuItemData {
	label?: string
	url?: string
	itemType?: string
	parentId?: number
	target?: string
	sortOrder?: number
	status?: string
}

export async function listMenus(db: any) {
	const allMenus = await db.select().from(menus).orderBy(asc(menus.name))
	const result = []
	for (const menu of allMenus) {
		const items = await db.select().from(menuItems)
			.where(eq(menuItems.menuId, menu.id))
			.orderBy(asc(menuItems.sortOrder))
		result.push({ ...menu, items })
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

	return { ...menu, items }
}

export async function deleteMenu(db: any, id: number) {
	await db.delete(menuItems).where(eq(menuItems.menuId, id))
	await db.delete(menus).where(eq(menus.id, id))
}

export async function getMenuItems(db: any, menuId: number) {
	return db.select().from(menuItems)
		.where(eq(menuItems.menuId, menuId))
		.orderBy(asc(menuItems.sortOrder))
}

export async function createMenuItem(db: any, data: CreateMenuItemData) {
	if (!data.label) throw new ValidationError('Label required')

	const [menu] = await db.select().from(menus).where(eq(menus.id, data.menuId)).limit(1)
	if (!menu) throw new NotFoundError('Menu')

	const count = await db.select({ count: menuItems.id }).from(menuItems).where(eq(menuItems.menuId, data.menuId))
	const sortOrder = data.sortOrder ?? (count?.length || 0)

	const [item] = await db.insert(menuItems).values({
		menuId: data.menuId,
		parentId: data.parentId ?? null,
		itemType: data.itemType || 'custom',
		label: data.label,
		url: data.url ?? null,
		target: data.target || '_self',
		sortOrder
	}).returning()

	return item
}

export async function updateMenuItem(db: any, id: number, data: UpdateMenuItemData) {
	const updateData: any = {}
	if (data.label !== undefined) updateData.label = data.label
	if (data.url !== undefined) updateData.url = data.url
	if (data.itemType !== undefined) updateData.itemType = data.itemType
	if (data.parentId !== undefined) updateData.parentId = data.parentId
	if (data.target !== undefined) updateData.target = data.target
	if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
	if (data.status !== undefined) updateData.status = data.status

	await db.update(menuItems).set(updateData).where(eq(menuItems.id, id))

	const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id)).limit(1)
	if (!item) throw new NotFoundError('Menu item')

	return item
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
		result.push({ ...menu, items })
	}
	return result
}
