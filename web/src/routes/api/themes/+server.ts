import { json } from '@sveltejs/kit'
import { listThemes, scanThemes } from '$lib/server/themes'
import { verifyAuth } from '$lib/server/auth'

export async function GET(event) {
  const data = listThemes()
  return json({ success: true, data })
}

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const body = await event.request.json()
    if (body.action === 'scan') {
      scanThemes()
      return json({ success: true, data: listThemes() })
    }
    return json({ success: false, error: 'Invalid action' }, 400)
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
