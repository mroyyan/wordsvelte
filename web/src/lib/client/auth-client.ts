export interface SessionUser {
  id: number
  role: 'admin' | 'editor' | 'author'
  email: string
  username: string
  displayName: string
  language?: string | null
}

/** Store the session for the admin pages, which call the API with a Bearer token from localStorage. */
export function saveSession(token: string, user: unknown) {
  localStorage.setItem('wordsvelte_token', token)
  localStorage.setItem('wordsvelte_user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('wordsvelte_token')
  localStorage.removeItem('wordsvelte_user')
}

export async function signOut() {
  try { await fetch('/api/auth/logout', { method: 'POST' }) } catch { /* cookie is cleared by the next failed auth anyway */ }
  clearSession()
  window.location.href = '/admin/login'
}

export const initials = (name?: string) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || '?'
