import { json } from '@sveltejs/kit'
import { getDb } from '$lib/server/db'
import { hashPassword } from '$lib/server/crypto'
import { createToken, setAuthCookie } from '$lib/server/auth'
import { users } from '@wordsvelte/shared'
import { catchError } from '$lib/server/response'
import { AppError } from '$lib/server/errors'

export async function POST(event) {
  try {
    const db = getDb(event as any)
    const [existing] = await db.select().from(users).limit(1)
    if (existing) throw new AppError('Setup already completed', 403)

    const body = await event.request.json()
    const { email, username, password, displayName } = body
    if (!email || !username || !password || !displayName) {
      throw new AppError('All fields required', 400)
    }

    const passwordHash = await hashPassword(password)
    const [user] = await db.insert(users).values({
      email, username, passwordHash, displayName, role: 'admin'
    }).returning()

    const token = await createToken({ userId: user.id, role: user.role }, event as any)
    setAuthCookie(event, token)

    return json({ success: true, data: { token, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role } } }, { status: 201 })
  } catch (e) { return catchError(e) }
}

export async function GET(event) {
  const db = getDb(event as any)
  const [existing] = await db.select().from(users).limit(1)
  return json({ success: true, data: { needsSetup: !existing } })
}
