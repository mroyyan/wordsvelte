export const STATE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Exact origin match (scheme + host + port); `null`/unparsable origins never match. */
export function isSameOrigin(candidate: string, serverOrigin: string): boolean {
	try {
		return new URL(candidate).origin === new URL(serverOrigin).origin
	} catch {
		return false
	}
}

/** True when a state-changing request must be rejected as a possible cross-site forgery. */
export function isCsrfViolation(req: { method: string; headers: Headers; serverOrigin: string; hasAuthCookie: boolean }): boolean {
	if (!STATE_METHODS.has(req.method)) return false

	const origin = req.headers.get('origin')
	const referer = req.headers.get('referer')

	if (req.headers.get('sec-fetch-site') === 'cross-site') return true
	if (origin) return !isSameOrigin(origin, req.serverOrigin)
	if (referer) return !isSameOrigin(referer, req.serverOrigin)

	// A cookie-authenticated request that proves nothing about where it came from.
	// Non-browser clients (curl, server-to-server) authenticate with a Bearer header instead.
	return req.hasAuthCookie
}
