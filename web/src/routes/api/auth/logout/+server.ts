import { clearAuthCookie } from '$lib/server/auth'
import { ok } from '$lib/server/http/response'

export async function POST(event) {
  clearAuthCookie(event)
  return ok({})
}
