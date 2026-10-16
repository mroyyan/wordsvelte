import { ValidationError } from '$lib/server/errors'

export const THEME_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

export function assertThemeSlug(slug: string): string {
  if (typeof slug !== 'string' || !THEME_SLUG_RE.test(slug)) throw new ValidationError('Invalid theme slug')
  return slug
}

/** Normalise a relative path inside a theme; rejects traversal, absolute and odd paths. Returns null if unsafe. */
export function safeRelativePath(path: string): string | null {
  if (typeof path !== 'string' || path.length === 0 || path.length > 255) return null
  if (path.includes('\0') || path.includes('\\') || path.startsWith('/') || /^[a-zA-Z]:/.test(path)) return null
  const parts = path.split('/')
  if (parts.some(p => p === '' || p === '.' || p === '..')) return null
  return parts.join('/')
}

export function assertSafeRelativePath(path: string): string {
  const safe = safeRelativePath(path)
  if (!safe) throw new ValidationError(`Unsafe path: ${String(path).slice(0, 80)}`)
  return safe
}
