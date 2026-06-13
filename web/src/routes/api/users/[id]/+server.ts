import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { users } from '@wordsvelte/shared'
import { ok, catchError } from '$lib/server/response'
import { AppError } from '$lib/server/errors'

export async function PATCH(event) {
  try {
    const auth = await verifyAuth(event as any)
    const id = parseInt(event.params.id)
    if (id === 1) throw new AppError('Cannot modify the primary admin', 403)
    if (auth.userId === id) throw new AppError('Cannot modify your own account', 403)

    const body = await event.request.json()
    const db = getDb(event as any)

    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
    if (!existing) throw new AppError('User not found', 404)

    const updateData: any = { updatedAt: new Date().toISOString() }
    if (body.displayName !== undefined) updateData.displayName = body.displayName
    if (body.email !== undefined) updateData.email = body.email
    if (body.role !== undefined) updateData.role = body.role

    await db.update(users).set(updateData).where(eq(users.id, id))
    const [updated] = await db.select({
      id: users.id, email: users.email, username: users.username,
      displayName: users.displayName, role: users.role, avatarUrl: users.avatarUrl, createdAt: users.createdAt
    }).from(users).where(eq(users.id, id)).limit(1)

    return ok(updated)
  } catch (e) { return catchError(e) }
}
