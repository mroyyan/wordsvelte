import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { settings } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  const db = getDb(event as any)
  const all = await db.select().from(settings)
  const data: Record<string, string> = {}
  all.forEach((s: any) => { data[s.key] = s.value })
  return json({ success: true, data })
}

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const body = await event.request.json()
    const db = getDb(event as any)
    for (const [key, value] of Object.entries(body)) {
      await db.insert(settings).values({ key, value: value as string }).onConflictDoUpdate({ target: settings.key, set: { value: value as string } })
    }
    return json({ success: true })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
