import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { createToken } from '$lib/server/auth'
import { hashPassword } from '$lib/server/crypto'
import { users } from '@kubus/shared/src/db-schema'

export async function POST({ request, platform }) {
  const body = await request.json()
  const { email, username, password, displayName } = body
  if (!email || !username || !password || !displayName) return json({ success: false, error: 'All fields required' }, 400)

  const db = getDb({ platform } as any)
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing.length) return json({ success: false, error: 'Email already registered' }, 409)

  const passwordHash = await hashPassword(password)
  const [user] = await db.insert(users).values({ email, username, passwordHash, displayName, role: 'author' }).returning()
  const token = await createToken({ userId: user.id, role: user.role }, { platform } as any)
  return json({ success: true, data: { token, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role } } }, 201)
}
