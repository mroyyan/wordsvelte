/**
 * Thin client for the JSON API used by the admin screens. Sends the stored Bearer token and turns
 * `{ success: false, error }` (or a network failure) into a thrown Error with a readable message.
 */
import { tr } from '$lib/i18n/admin'

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem('wordsvelte_token') ?? ''}` }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(path, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
  } catch {
    throw new Error(tr('Network error, please try again'))
  }
  const json = await res.json().catch(() => null)
  if (!json?.success) throw new Error(json?.error || tr('Request failed ({status})', { status: res.status }))
  return json.data as T
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : tr('Something went wrong'))

/** Run `fn` for every row, collecting failures instead of stopping at the first one. */
export async function runBulk<T>(rows: T[], fn: (row: T) => Promise<unknown>): Promise<{ ok: number; failed: number; firstError?: string }> {
  let ok = 0
  let failed = 0
  let firstError: string | undefined
  for (const row of rows) {
    try { await fn(row); ok++ } catch (e) { failed++; firstError ??= errorMessage(e) }
  }
  return { ok, failed, firstError }
}

/** Load every page of a paginated endpoint (`{ data, totalPages }`) so tables can filter and sort the full set client-side. */
export async function fetchAll<T = any>(path: string, pageSize = 100, maxPages = 50): Promise<T[]> {
  const out: T[] = []
  const sep = path.includes('?') ? '&' : '?'
  for (let page = 1; page <= maxPages; page++) {
    const headers = { Authorization: `Bearer ${localStorage.getItem('wordsvelte_token') ?? ''}` }
    const res = await fetch(`${path}${sep}limit=${pageSize}&page=${page}`, { headers })
    const json = await res.json().catch(() => null)
    if (!json?.success) throw new Error(json?.error || tr('Request failed ({status})', { status: res.status }))
    out.push(...(json.data as T[]))
    if (page >= (json.totalPages ?? 1)) break
  }
  return out
}
