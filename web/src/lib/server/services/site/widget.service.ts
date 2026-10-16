import type { DbInstance } from '$lib/server/db'
import { createWidgetRepository } from '$lib/server/repositories/widgets.repository'
import { ValidationError, NotFoundError } from '$lib/server/core/errors'
import { sanitizeHtml } from '$lib/server/core/sanitize'

/** Free-form HTML widgets are rendered raw on the public site, so they are sanitized on write. */
const cleanContent = (type: string | undefined, content: string | null | undefined) =>
	type === 'html' ? sanitizeHtml(content) : (content ?? null)

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

export async function listWidgets(db: DbInstance) {
	return createWidgetRepository(db).list()
}

export async function createWidget(db: DbInstance, data: CreateWidgetData) {
	if (!data.widgetType) throw new ValidationError('widgetType required')

	return createWidgetRepository(db).insert({
		widgetType: data.widgetType,
		title: data.title ?? null,
		content: cleanContent(data.widgetType, data.content),
		settings: data.settings ?? null,
		sidebarArea: data.sidebarArea || 'sidebar-1',
		sortOrder: data.sortOrder ?? 0
	})
}

export async function updateWidget(db: DbInstance, id: number, data: UpdateWidgetData) {
	const widgets = createWidgetRepository(db)
	const updateData: any = {}
	if (data.widgetType !== undefined) updateData.widgetType = data.widgetType
	if (data.title !== undefined) updateData.title = data.title
	if (data.content !== undefined) {
		const current = await widgets.findById(id)
		updateData.content = cleanContent(data.widgetType ?? current?.widgetType, data.content)
	}
	if (data.settings !== undefined) updateData.settings = data.settings
	if (data.sidebarArea !== undefined) updateData.sidebarArea = data.sidebarArea
	if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder
	if (data.status !== undefined) updateData.status = data.status
	updateData.updatedAt = new Date().toISOString()

	await widgets.update(id, updateData)

	const item = await widgets.findById(id)
	if (!item) throw new NotFoundError('Widget')

	return item
}

export async function deleteWidget(db: DbInstance, id: number) {
	await createWidgetRepository(db).delete(id)
}

export async function getPublicWidgets(db: DbInstance) {
	return createWidgetRepository(db).list({ activeOnly: true })
}
