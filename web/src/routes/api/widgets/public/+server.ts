import { json } from '@sveltejs/kit'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { widgets } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  const url = new URL(event.request.url)
  const area = url.searchParams.get('area') || 'sidebar-1'
  const db = getDb(event as any)
  const data = await db.select().from(widgets)
    .where(eq(widgets.status, 'active'))
    .orderBy(asc(widgets.sortOrder))
  const filtered = area ? data.filter(w => w.sidebarArea === area) : data
  return json({ success: true, data: filtered })
}
