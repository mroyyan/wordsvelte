import { redirect } from '@sveltejs/kit'
import { verifyAuth } from '$lib/server/auth'
import { getDb } from '$lib/server/db'
import { users } from '@wordsvelte/shared'

export async function load(event) {
  // Public pages
  if (event.url.pathname === '/admin/login' || event.url.pathname === '/admin/setup') return {}

  // Check if setup needed
  try {
    const db = getDb(event as any)
    const [existing] = await db.select().from(users).limit(1)
    if (!existing) throw redirect(302, '/admin/setup')
  } catch (e: any) {
    if (e.status === 302) throw e
  }

  // Verify auth
  try {
    await verifyAuth(event as any)
    return {}
  } catch {
    throw redirect(302, '/admin/login')
  }
}
