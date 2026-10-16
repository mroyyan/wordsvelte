import { error } from '@sveltejs/kit'
import { AppError } from '$lib/server/core/errors'

/** For page loaders: show a service's expected failures (404 and friends) as SvelteKit error pages; anything else is a real 500. */
export function toKitError(e: unknown): never {
  if (e instanceof AppError) throw error(e.status as 400 | 401 | 403 | 404, e.message)
  throw e
}
