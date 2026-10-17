import { getDb } from '$lib/server/db'
import { getSettings } from '$lib/server/services/site/settings.service'

/** The IAB ads.txt that ad networks (AdSense and others) ask for at the site root. Edited in Settings > Ads. */
export async function GET(event) {
  const settings = await getSettings(getDb(event as any))
  const body = (settings.ads_txt ?? '').trim()
  return new Response(body ? body + '\n' : '', {
    status: body ? 200 : 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  })
}
