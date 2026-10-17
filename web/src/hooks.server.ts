import type { Handle } from '@sveltejs/kit'
import { AUTH_COOKIE } from '$lib/server/auth'
import { isCsrfViolation } from '$lib/server/http/csrf'
import { ensureLocalDb, getDb } from '$lib/server/db'
import { publishDueIfNeeded } from '$lib/server/services/content/scheduler.service'
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

	// Scheduled posts go live when their time has come (see scheduler.service: Pages has no cron).
	if (!event.url.pathname.startsWith('/_app/') && !event.url.pathname.startsWith('/api/media/')) {
		try { await publishDueIfNeeded(getDb(event)) } catch { /* no database yet (first run / misconfiguration): the page itself reports it */ }
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
