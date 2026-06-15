import type { Handle } from '@sveltejs/kit'

const STATE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function isAllowedOrigin(requestOrigin: string, serverOrigin: string): boolean {
	try {
		const req = new URL(requestOrigin)
		const srv = new URL(serverOrigin)
		return req.hostname === srv.hostname && req.protocol === srv.protocol
	} catch {
		return false
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	// CSRF check: validate Origin/Referer on state-changing requests
	if (STATE_METHODS.has(event.request.method)) {
		const origin = event.request.headers.get('origin')
		const referer = event.request.headers.get('referer')
		const serverOrigin = event.url.origin

		if (origin) {
			if (!isAllowedOrigin(origin, serverOrigin)) {
				return new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				})
			}
		} else if (referer) {
			if (!isAllowedOrigin(referer, serverOrigin)) {
				return new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				})
			}
		}
		// No Origin/Referer → allow (non-browser clients like curl, server-to-server)
	}

	return await resolve(event)
}
