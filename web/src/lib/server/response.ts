import { json } from '@sveltejs/kit'
import { AppError } from '$lib/server/errors'

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
  if (e instanceof AppError) {
    return json({ success: false, error: e.message }, { status: e.status })
  }
  return json({ success: false, error: 'Internal error' }, { status: 500 })
}
