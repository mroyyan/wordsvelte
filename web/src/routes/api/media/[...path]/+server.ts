import { catchError } from '$lib/server/response'

export async function GET({ params, platform }: any) {
	try {
		const r2 = platform?.env?.R2
		if (!r2 || !params.path) return new Response('Not found', { status: 404 })
		const obj = await r2.get(params.path)
		if (!obj) return new Response('Not found', { status: 404 })
		return new Response(obj.body, {
			headers: {
				'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
				'Cache-Control': 'public, max-age=31536000',
			},
		})
	} catch (e) { return catchError(e) }
}
