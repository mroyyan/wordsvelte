import { redirect } from '@sveltejs/kit'
import { requireUser } from '$lib/server/auth'
import { getDb } from '$lib/server/db'
import { needsSetup } from '$lib/server/services/account/user.service'
import { isAuthPage } from '$lib/config/auth-pages'

export async function load(event) {
  // Public pages (auth screens render without the admin shell)
  if (isAuthPage(event.url.pathname)) return { user: null }

  // Check if setup needed
  try {
    if (await needsSetup(getDb(event as any))) throw redirect(302, '/admin/setup')
  } catch (e: any) {
    if (e.status === 302) throw e
  }

  // Verify auth
  try {
    const user = await requireUser(event as any)
    return { user: { id: user.userId, role: user.role, email: user.email, username: user.username, displayName: user.displayName, language: user.language } }
  } catch {
    throw redirect(302, '/admin/login')
  }
}
