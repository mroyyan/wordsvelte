import { eq, asc } from 'drizzle-orm'
import { widgets } from '@wordsvelte/shared'
import { ValidationError, NotFoundError } from '$lib/server/errors'

interface CreateWidgetData {
	widgetType: string
	title?: string
	content?: string
	settings?: any
	sidebarArea?: string
	sortOrder?: number
}

interface UpdateWidgetData {
	widgetType?: string
	title?: string
	content?: string
	settings?: any
	sidebarArea?: string
	sortOrder?: number
	status?: string
}

export async function listWidgets(db: any) {
	return db.select().from(widgets).orderBy(asc(widgets.sortOrder))
}

export async function createWidget(db: any, data: CreateWidgetData) {
	if (!data.widgetType) throw new ValidationError('widgetType required')

	const [item] = await db.insert(widgets).values({
		widgetType: data.widgetType,
		title: data.title ?? null,
		content: data.content ?? null,
		settings: data.settings ?? null,
		sidebarArea: data.sidebarArea || 'sidebar-1',
		sortOrder: data.sortOrder ?? 0
	}).returning()

	return item
}

export async function updateWidget(db: any, id: number, data: UpdateWidgetData) {
	const updateData: any = {}
	if (data.widgetType !== undefined) updateData.widgetType = data.widgetType
	if (data.title !== undefined) updateData.title = data.title
	if (data.content !== undefined) updateData.content = data.content
	if (data.settings !== undefined) updateData.settings = data.settings
	if (data.sidebarArea !== undefined) updateData.sidebarArea = data.sidebarArea
	if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
	if (data.status !== undefined) updateData.status = data.status
	updateData.updatedAt = new Date().toISOString()

	await db.update(widgets).set(updateData).where(eq(widgets.id, id))

	const [item] = await db.select().from(widgets).where(eq(widgets.id, id)).limit(1)
	if (!item) throw new NotFoundError('Widget')

	return item
}

export async function deleteWidget(db: any, id: number) {
	await db.delete(widgets).where(eq(widgets.id, id))
}

export async function getPublicWidgets(db: any) {
	return db.select().from(widgets)
		.where(eq(widgets.status, 'active'))
		.orderBy(asc(widgets.sortOrder))
}
