import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { createToken, setAuthCookie } from '$lib/server/auth'
import { catchError, created, readJson } from '$lib/server/http/response'
import { createFirstAdmin, needsSetup } from '$lib/server/services/account/user.service'

export async function POST(event) {
  try {
    const db = getDb(event as any)
    const body = await readJson(event.request)
    const user = await createFirstAdmin(db, {
      email: body.email, username: body.username, password: body.password, displayName: body.displayName,
    })
    const token = await createToken({ userId: user.id, role: user.role }, event as any)
    setAuthCookie(event, token)
    return created({ token, user })
  } catch (e) { return catchError(e) }
}

export async function GET(event) {
  try {
    return json({ success: true, data: { needsSetup: await needsSetup(getDb(event as any)) } })
  } catch (e) { return catchError(e) }
}
