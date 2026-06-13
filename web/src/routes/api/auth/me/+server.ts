import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { users } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  try {
    const { userId } = await verifyAuth(event as any)
    const db = getDb(event as any)
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) return json({ success: false, error: 'Not found' }, 404)
    return json({ success: true, data: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role, avatarUrl: user.avatarUrl } })
  } catch (e: any) {
    return json({ success: false, error: e.message }, 401)
  }
}
