import { verifyAuth } from '$lib/server/auth'
import { catchError, ok } from '$lib/server/response'

export async function GET(event) {
  try {
    const user = await verifyAuth(event as any)
    return ok(user)
  } catch (e) { return catchError(e) }
}
