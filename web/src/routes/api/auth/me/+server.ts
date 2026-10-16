import { requireUser } from '$lib/server/auth'
import { catchError, ok } from '$lib/server/response'

export async function GET(event) {
  try {
    return ok(await requireUser(event as any))
  } catch (e) { return catchError(e) }
}
