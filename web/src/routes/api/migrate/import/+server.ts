import { verifyAuth } from '$lib/server/auth'
import { getDb } from '$lib/server/db'
import { runImport } from '$lib/server/services/migrate.service'
import { ValidationError } from '$lib/server/errors'

export async function POST(event: any) {
  try {
    const user = await verifyAuth(event)
    const formData = await event.request.formData()
    const file = formData.get('file') as File | null
    if (!file) throw new ValidationError('No file provided')

    const xml = await file.text()
    const db = getDb(event)
    const r2 = event.platform?.env?.R2

    if (!r2) throw new ValidationError('R2 storage not available')

    // SSE response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        function sendProgress(data: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          await runImport(xml, db, r2, user.userId, sendProgress)
        } catch (err: any) {
          sendProgress({ stage: 'error', current: 0, total: 0, message: err.message || 'Import failed' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message || 'Internal error' }), {
      status: e instanceof ValidationError ? 400 : 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
