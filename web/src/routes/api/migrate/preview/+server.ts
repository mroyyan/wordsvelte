import { verifyAuth } from '$lib/server/auth'
import { ok, catchError } from '$lib/server/response'
import { getPreview } from '$lib/server/services/migrate.service'
import { ValidationError } from '$lib/server/errors'

export async function POST(event: any) {
  try {
    await verifyAuth(event)
    const formData = await event.request.formData()
    const file = formData.get('file') as File | null
    if (!file) throw new ValidationError('No file provided')
    if (!file.name.endsWith('.xml') && !file.name.endsWith('.wxr')) {
      throw new ValidationError('File must be a WordPress XML export (.xml or .wxr)')
    }
    if (file.size > 100 * 1024 * 1024) {
      throw new ValidationError('File too large (max 100MB)')
    }

    const xml = await file.text()
    const preview = getPreview(xml)
    return ok(preview)
  } catch (e) {
    return catchError(e)
  }
}
