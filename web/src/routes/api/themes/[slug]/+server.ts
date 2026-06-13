import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/response'
import { activateTheme } from '$lib/server/services/theme.service'

export async function PUT(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    await activateTheme(db, event.params.slug, (event as any).platform)
    return ok({ slug: event.params.slug, active: true })
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    await verifyAuth(event as any)
    return json({ success: false, error: 'Delete theme not supported yet. Remove manually from themes folder.' }, { status: 400 })
  } catch (e) { return catchError(e) }
}
