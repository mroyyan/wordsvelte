import { json } from '@sveltejs/kit'
import { setActiveTheme, getActiveTheme } from '$lib/server/themes'
import { verifyAuth } from '$lib/server/auth'
import { getDb } from '$lib/server/db'
import { settings } from '@kubus/shared/src/db-schema'
import { eq } from 'drizzle-orm'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const THEMES_DIR = join(__dirname, '..', '..', '..', '..', '..', 'themes')

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const slug = event.params.slug
    const db = getDb(event as any)
    await db.insert(settings).values({ key: 'theme', value: slug }).onConflictDoUpdate({ target: settings.key, set: { value: slug } })
    setActiveTheme(slug)
    return json({ success: true, data: { slug, active: true } })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    return json({ success: false, error: 'Delete theme not supported yet. Remove manually from themes folder.' }, 400)
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
