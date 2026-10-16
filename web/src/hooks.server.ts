import type { Handle } from '@sveltejs/kit'
import { AUTH_COOKIE } from '$lib/server/auth'
import { isCsrfViolation } from '$lib/server/csrf'
import { ensureLocalDb } from '$lib/server/db'
import { ensureLocalThemeStorage } from '$lib/server/themes/storage'

export const handle: Handle = async ({ event, resolve }) => {
	// No-ops in production builds (dev-only SQLite + filesystem themes).
	await ensureLocalDb()
	await ensureLocalThemeStorage()

	if (isCsrfViolation({
		method: event.request.method,
		headers: event.request.headers,
		serverOrigin: event.url.origin,
		hasAuthCookie: !!event.cookies.get(AUTH_COOKIE),
	})) {
		return new Response(JSON.stringify({ success: false, error: 'CSRF validation failed' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		})
	}

	const response = await resolve(event)
	try {
		// the admin and the API must never be indexed, whatever the site-wide setting says
		const { pathname } = event.url
		if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/')) {
			response.headers.set('X-Robots-Tag', 'noindex, nofollow')
		}
		response.headers.set('X-Content-Type-Options', 'nosniff')
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
		response.headers.set('X-Frame-Options', 'SAMEORIGIN')
	} catch {
		// Immutable (e.g. proxied/redirect) responses: skip the extra headers.
	}
	return response
}
