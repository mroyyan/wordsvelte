import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, created, catchError, readJson } from '$lib/server/http/response'
import { listAds, createAd } from '$lib/server/services/site/ads.service'

// Ads can carry arbitrary scripts, so managing them (and even reading the code) is for administrators only.
export async function GET(event: any) {
  try {
    await requireUser(event, 'admin')
    return ok(await listAds(getDb(event)))
  } catch (e) { return catchError(e) }
}

export async function POST(event: any) {
  try {
    await requireUser(event, 'admin')
    return created(await createAd(getDb(event), await readJson(event.request)))
  } catch (e) { return catchError(e) }
}
