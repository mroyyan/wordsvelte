import { requireUser } from '$lib/server/auth'
import { ok, catchError, readJson } from '$lib/server/http/response'
import { ValidationError } from '$lib/server/core/errors'
import { listThemes, scanThemes } from '$lib/server/services/site/theme.service'

export async function GET(event) {
  try {
    await requireUser(event as any, 'admin')
    return ok(await listThemes((event as any).platform))
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    await requireUser(event as any, 'admin')
    const body = await readJson(event.request)
    if (body.action !== 'scan') throw new ValidationError('Invalid action')
    await scanThemes((event as any).platform)
    return ok(await listThemes((event as any).platform))
  } catch (e) { return catchError(e) }
}
