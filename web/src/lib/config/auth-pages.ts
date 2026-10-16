/** Screens that render without the admin shell (and without a signed-in user). */
export const AUTH_PAGES = ['/admin/login', '/admin/setup', '/admin/forgot-password', '/admin/reset-password']

export function isAuthPage(pathname: string): boolean {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return AUTH_PAGES.includes(clean)
}
