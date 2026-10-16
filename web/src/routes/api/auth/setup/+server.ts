import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { createToken, setAuthCookie } from '$lib/server/auth'
import { users } from '@wordsvelte/shared'
import { catchError, created, readJson } from '$lib/server/response'
import { createFirstAdmin } from '$lib/server/services/user.service'

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
    const db = getDb(event as any)
    const [existing] = await db.select({ id: users.id }).from(users).limit(1)
    return json({ success: true, data: { needsSetup: !existing } })
  } catch (e) { return catchError(e) }
}
