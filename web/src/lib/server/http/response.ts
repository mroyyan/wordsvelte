import { json } from '@sveltejs/kit'
import { AppError, RateLimitError, ValidationError } from '$lib/server/core/errors'

export function ok(data: any) {
  return json({ success: true, data })
}

export function okPaginated(data: any[], total: number, page: number, limit: number) {
  return json({ success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) })
}

export function created(data: any) {
  return json({ success: true, data }, { status: 201 })
}

export function catchError(e: unknown) {
  if (e instanceof RateLimitError) {
    return json({ success: false, error: e.message }, { status: 429, headers: { 'Retry-After': String(e.retryAfterSeconds) } })
  }
  if (e instanceof AppError) {
    return json({ success: false, error: e.message }, { status: e.status })
  }
  console.error('Unhandled error:', e)
  return json({ success: false, error: 'Internal error' }, { status: 500 })
}

/** Parse a positive integer query/param, falling back (and clamping) so NaN/negative/huge values can't reach the DB. */
export function parseIntParam(value: string | null | undefined, fallback: number, opts: { min?: number; max?: number } = {}): number {
  const n = parseInt(value ?? '', 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(opts.max ?? Number.MAX_SAFE_INTEGER, Math.max(opts.min ?? 1, n))
}

/** Parse a JSON request body, turning malformed JSON into a 400 instead of a 500. */
export async function readJson(request: Request): Promise<any> {
  try {
    const body = await request.json()
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object')
    return body
  } catch {
    throw new ValidationError('Request body must be a JSON object')
  }
}
