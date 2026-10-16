import { catchError } from '$lib/server/response'
import { isPublicMediaKey } from '$lib/server/uploads'

export async function GET({ params, platform }: any) {
	try {
		const r2 = platform?.env?.R2
		if (!r2 || !isPublicMediaKey(params.path)) return new Response('Not found', { status: 404 })
		const obj = await r2.get(params.path)
		if (!obj) return new Response('Not found', { status: 404 })

		const type: string = obj.httpMetadata?.contentType || 'application/octet-stream'
		const isImage = /^image\/(jpeg|png|gif|webp|avif)$/.test(type)
		return new Response(obj.body, {
			headers: {
				// Anything that is not a known-safe raster image is forced to download and never sniffed/rendered in-origin.
				'Content-Type': isImage ? type : 'application/octet-stream',
				'Content-Disposition': isImage ? 'inline' : 'attachment',
				'X-Content-Type-Options': 'nosniff',
				'Content-Security-Policy': "default-src 'none'; sandbox",
				'Cache-Control': 'public, max-age=31536000, immutable',
			},
		})
	} catch (e) { return catchError(e) }
}
