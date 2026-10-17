import { describe, it, expect, vi } from 'vitest'
import { handle } from '../../src/hooks.server'
import { makeCookies } from '../helpers/harness'

function run(opts: { method?: string; headers?: Record<string, string>; cookie?: boolean; url?: string; resolveWith?: Response }) {
  const url = new URL(opts.url ?? 'https://news.example.com/api/posts')
  const event: any = {
    url,
    request: new Request(url, { method: opts.method ?? 'GET', headers: opts.headers }),
    cookies: makeCookies(opts.cookie ? { wordsvelte_token: 'tok' } : {}),
  }
  const resolve = vi.fn(async () => opts.resolveWith ?? new Response('ok'))
  return (handle as any)({ event, resolve }).then((res: Response) => ({ res, resolve }))
}

describe('handle(): CSRF', () => {
  it('lets GET requests through and adds security headers', async () => {
    const { res, resolve } = await run({})
    expect(resolve).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('X-Frame-Options')).toBe('SAMEORIGIN')
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('blocks cross-origin POST with a JSON 403 and never reaches the app', async () => {
    const { res, resolve } = await run({ method: 'POST', headers: { origin: 'https://evil.example' }, cookie: true })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ success: false, error: 'CSRF validation failed' })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('allows same-origin POST/DELETE', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const { res } = await run({ method, headers: { origin: 'https://news.example.com' }, cookie: true })
      expect(res.status).toBe(200)
    }
  })

  it('blocks a cookie-authenticated POST that carries no Origin/Referer, but allows Bearer-only API clients', async () => {
    expect((await run({ method: 'POST', cookie: true })).res.status).toBe(403)
    expect((await run({ method: 'POST', headers: { authorization: 'Bearer abc' } })).res.status).toBe(200)
  })

  it('blocks scheme/port downgrades of the same host', async () => {
    expect((await run({ method: 'POST', headers: { origin: 'http://news.example.com' } })).res.status).toBe(403)
    expect((await run({ method: 'POST', headers: { origin: 'https://news.example.com:444' } })).res.status).toBe(403)
  })

  it('does not choke on immutable responses (e.g. redirects) when adding headers', async () => {
    const { res } = await run({ resolveWith: Response.redirect('https://news.example.com/x', 302) })
    expect(res.status).toBe(302)
  })
})

describe('handle(): <html lang>', () => {
  it('fills the lang placeholder from the language the layout stored on event.locals', async () => {
    for (const [lang, expected] of [['en', 'en'], [undefined, 'id']] as const) {
      const url = new URL('https://news.example.com/')
      const event: any = { url, request: new Request(url), cookies: makeCookies(), locals: { lang } }
      let chunk = ''
      const resolve = async (_e: any, opts?: any) => {
        chunk = opts?.transformPageChunk?.({ html: '<html lang="%lang%">', done: true }) ?? ''
        return new Response('ok')
      }
      await (handle as any)({ event, resolve })
      expect(chunk).toBe(`<html lang="${expected}">`)
    }
  })
})
