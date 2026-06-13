import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { widgets } from '@kubus/shared/src/db-schema'
import { asc } from 'drizzle-orm'

export async function GET(event) {
  const db = getDb(event as any)
  const data = await db.select().from(widgets).orderBy(asc(widgets.sortOrder))
  return json({ success: true, data })
}

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const body = await event.request.json()
    if (!body.widgetType) return json({ success: false, error: 'widgetType required' }, 400)
    const db = getDb(event as any)
    const [item] = await db.insert(widgets).values({
      widgetType: body.widgetType,
      title: body.title || null,
      content: body.content || null,
      settings: body.settings || null,
      sidebarArea: body.sidebarArea || 'sidebar-1',
      sortOrder: body.sortOrder || 0,
    }).returning()
    return json({ success: true, data: item }, 201)
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
