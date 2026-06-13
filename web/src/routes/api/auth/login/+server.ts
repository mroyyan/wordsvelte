import { json } from '@sveltejs/kit'
import { createToken, setAuthCookie } from '$lib/server/auth'
import { catchError, ok } from '$lib/server/response'
import { validateLogin } from '$lib/server/services/user.service'
import { getDb } from '$lib/server/db'

export async function POST(event) {
  try {
    const { email, password } = await event.request.json()
    if (!email || !password) return json({ success: false, error: 'Email and password required' }, { status: 400 })
    const db = getDb(event as any)
    const user = await validateLogin(db, email, password)
    const token = await createToken({ userId: user.id, role: user.role }, event as any)
    setAuthCookie(event, token)
    return ok({ token, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role } })
  } catch (e) { return catchError(e) }
}
