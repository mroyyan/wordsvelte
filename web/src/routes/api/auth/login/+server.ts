import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { createToken } from '$lib/server/auth'
import { verifyPassword } from '$lib/server/crypto'
import { users } from '@kubus/shared/src/db-schema'

export async function POST({ request, platform }) {
  const body = await request.json()
  const { email, password } = body
  if (!email || !password) return json({ success: false, error: 'Email and password required' }, 400)

  const db = getDb({ platform } as any)
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) return json({ success: false, error: 'Invalid credentials' }, 401)

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) return json({ success: false, error: 'Invalid credentials' }, 401)

  const token = await createToken({ userId: user.id, role: user.role }, { platform } as any)
  return json({
    success: true, data: {
      token,
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role },
    },
  })
}
