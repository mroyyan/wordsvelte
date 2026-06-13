import { verifyAuth } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/response'
import { listThemes, scanThemes } from '$lib/server/services/theme.service'

export async function GET(event) {
  try {
    const data = await listThemes((event as any).platform)
    return ok(data)
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const body = await event.request.json()
    if (body.action === 'scan') {
      await scanThemes((event as any).platform)
      const data = await listThemes((event as any).platform)
      return ok(data)
    }
    return ok({ error: 'Invalid action' })
  } catch (e) { return catchError(e) }
}
