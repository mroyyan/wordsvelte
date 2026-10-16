import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, fetchAll, runBulk, errorMessage } from '../../src/lib/client/admin-api'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'wordsvelte_token' ? 'tok-123' : null) }) })
afterEach(() => { vi.unstubAllGlobals() })

describe('api()', () => {
  it('sends the Bearer token and unwraps data', async () => {
    const fetchMock = vi.fn(async () => json({ success: true, data: { id: 1 } }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await api('/api/x')).toEqual({ id: 1 })
    const [url, init] = fetchMock.mock.calls[0] as any
    expect(url).toBe('/api/x')
    expect(init.headers.Authorization).toBe('Bearer tok-123')
    expect(init.method).toBe('GET')
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('JSON-encodes bodies and sets the content type', async () => {
    const fetchMock = vi.fn(async () => json({ success: true, data: null }))
    vi.stubGlobal('fetch', fetchMock)
    await api('/api/x', { method: 'POST', body: { a: 1 } })
    const init = (fetchMock.mock.calls[0] as any)[1]
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"a":1}')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('turns API errors, non-JSON responses and network failures into readable Errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: false, error: 'Slug already in use' }, 409)))
    await expect(api('/api/x')).rejects.toThrow('Slug already in use')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>oops</html>', { status: 502 })))
    await expect(api('/api/x')).rejects.toThrow('Request failed (502)')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    await expect(api('/api/x')).rejects.toThrow('Network error')
  })
})

describe('fetchAll()', () => {
  it('walks every page (the old admin lists silently stopped at the first 500)', async () => {
    const pages: Record<string, any> = {
      '1': { success: true, data: [1, 2], totalPages: 3 },
      '2': { success: true, data: [3, 4], totalPages: 3 },
      '3': { success: true, data: [5], totalPages: 3 },
    }
    const fetchMock = vi.fn(async (url: string) => json(pages[new URL(url, 'http://x').searchParams.get('page')!]))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchAll('/api/things', 2)).toEqual([1, 2, 3, 4, 5])
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect((fetchMock.mock.calls[0] as any)[0]).toBe('/api/things?limit=2&page=1')
  })

  it('appends to an existing query string and stops after a single page', async () => {
    const fetchMock = vi.fn(async () => json({ success: true, data: ['a'], totalPages: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchAll('/api/things?status=draft')).toEqual(['a'])
    expect((fetchMock.mock.calls[0] as any)[0]).toBe('/api/things?status=draft&limit=100&page=1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats a missing totalPages as one page and never loops forever', async () => {
    const fetchMock = vi.fn(async () => json({ success: true, data: [1] }))
    vi.stubGlobal('fetch', fetchMock)
    await fetchAll('/api/x')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const endless = vi.fn(async () => json({ success: true, data: [1], totalPages: 9999 }))
    vi.stubGlobal('fetch', endless)
    await fetchAll('/api/x', 10, 5)
    expect(endless).toHaveBeenCalledTimes(5)
  })

  it('surfaces failures from any page', async () => {
    let n = 0
    vi.stubGlobal('fetch', vi.fn(async () => json(++n === 1 ? { success: true, data: [1], totalPages: 2 } : { success: false, error: 'Forbidden' }, n === 1 ? 200 : 403)))
    await expect(fetchAll('/api/x')).rejects.toThrow('Forbidden')
  })
})

describe('runBulk()', () => {
  it('continues past failures and reports counts and the first error', async () => {
    const seen: number[] = []
    const result = await runBulk([1, 2, 3, 4], async n => {
      seen.push(n)
      if (n % 2 === 0) throw new Error(`bad ${n}`)
    })
    expect(seen).toEqual([1, 2, 3, 4])
    expect(result).toEqual({ ok: 2, failed: 2, firstError: 'bad 2' })
  })

  it('handles an empty selection', async () => {
    expect(await runBulk([], async () => {})).toEqual({ ok: 0, failed: 0, firstError: undefined })
  })
})

describe('errorMessage()', () => {
  it('reads Error messages and falls back for anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('str')).toBe('Something went wrong')
    expect(errorMessage(null)).toBe('Something went wrong')
  })
})
