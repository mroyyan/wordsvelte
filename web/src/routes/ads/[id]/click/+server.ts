import { redirect, error } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { AppError } from '$lib/server/core/errors'
import { clientKey } from '$lib/server/http/rate-limit'
import { adClickByIp } from '$lib/server/http/limiters'
import { followAd, getAd } from '$lib/server/services/site/ads.service'

/** A banner click: count it, then send the visitor on. The destination comes from the stored ad, never from the request. */
export async function GET(event) {
  const id = Number(event.params.id)
  if (!Number.isInteger(id) || id < 1) throw error(404, 'Not found')

  const db = getDb(event as any)
  const ip = clientKey(event)
  let target: string | null
  try {
    if (adClickByIp.check(ip) > 0) {
      // Over the limit the visitor still reaches the advertiser; the click is just not counted again.
      target = (await getAd(db, id)).linkUrl
    } else {
      adClickByIp.hit(ip)
      target = await followAd(db, id)
    }
  } catch (e) {
    if (e instanceof AppError) throw error(e.status as 404, e.message)
    throw e
  }
  if (!target) throw error(404, 'Not found')
  throw redirect(302, target)
}
