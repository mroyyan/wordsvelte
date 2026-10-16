import { getDb } from '$lib/server/db'
import { created, catchError, readJson } from '$lib/server/response'
import { createComment } from '$lib/server/services/comment.service'
import { RateLimitError } from '$lib/server/errors'
import { clientKey } from '$lib/server/rate-limit'
import { commentLimiter } from '$lib/server/limiters'

export async function POST(event) {
  try {
    const key = clientKey(event)
    const wait = commentLimiter.check(key)
    if (wait > 0) throw new RateLimitError(wait)

    const body = await readJson(event.request)
    const comment = await createComment(getDb(event as any), body)
    commentLimiter.hit(key)
    return created(comment)
  } catch (e) { return catchError(e) }
}
