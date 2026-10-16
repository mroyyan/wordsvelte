import { requireUser } from '$lib/server/auth'
import { getDb } from '$lib/server/db'
import { runImport } from '$lib/server/services/site/migrate.service'
import { AppError, ValidationError } from '$lib/server/core/errors'
import { catchError } from '$lib/server/http/response'

const MAX_XML_BYTES = 100 * 1024 * 1024

export async function POST(event: any) {
  try {
    const user = await requireUser(event, 'admin')
    const formData = await event.request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) throw new ValidationError('No file provided')
    if (!/\.(xml|wxr)$/i.test(file.name)) throw new ValidationError('File must be a WordPress XML export (.xml or .wxr)')
    if (file.size > MAX_XML_BYTES) throw new ValidationError('File too large (max 100MB)')

    const r2 = event.platform?.env?.R2
    if (!r2) throw new AppError('R2 storage not available', 503)

    const xml = await file.text()
    const db = getDb(event)

    // SSE response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const sendProgress = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

        try {
          await runImport(xml, db, r2, user.userId, sendProgress)
        } catch (err: any) {
          console.error('Import failed:', err)
          sendProgress({ stage: 'error', current: 0, total: 0, message: 'Import failed' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    })
  } catch (e) { return catchError(e) }
}
