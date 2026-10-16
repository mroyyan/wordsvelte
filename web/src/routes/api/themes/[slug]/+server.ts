import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/http/response'
import { activateTheme } from '$lib/server/services/site/theme.service'

export async function PUT(event) {
  try {
    await requireUser(event as any, 'admin')
    const db = getDb(event as any)
    await activateTheme(db, event.params.slug, (event as any).platform)
    return ok({ slug: event.params.slug, active: true })
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await requireUser(event as any, 'admin')
    return json({ success: false, error: 'Delete theme not supported yet. Remove manually from themes folder.' }, { status: 400 })
  } catch (e) { return catchError(e) }
}
