import { json } from '@sveltejs/kit'
import { createToken, setAuthCookie } from '$lib/server/auth'
import { catchError, created } from '$lib/server/response'
import { createUser } from '$lib/server/services/user.service'
import { getDb } from '$lib/server/db'

export async function POST(event) {
  try {
    const { email, username, password, displayName } = await event.request.json()
    if (!email || !username || !password || !displayName) return json({ success: false, error: 'All fields required' }, { status: 400 })
    const db = getDb(event as any)
    const user = await createUser(db, { email, username, password, displayName })
    const token = await createToken({ userId: user.id, role: user.role }, event as any)
    setAuthCookie(event, token)
    return created({ token, user })
  } catch (e) { return catchError(e) }
}
