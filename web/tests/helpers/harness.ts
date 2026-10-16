import { getDb } from '$lib/server/db'
import { createUser } from '$lib/server/services/account/user.service'
import { createToken } from '$lib/server/auth'

export const JWT_SECRET = 'test-secret-that-is-long-enough-123456'

export function makeCookies(initial: Record<string, string> = {}) {
  const jar = new Map(Object.entries(initial))
  return {
    jar,
    get: (k: string) => jar.get(k),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (k: string, v: string) => { jar.set(k, v) },
    delete: (k: string) => { jar.delete(k) },
    serialize: () => '',
  }
}

export interface EventOpts {
  method?: string
  path?: string
  query?: Record<string, string>
  params?: Record<string, string>
  body?: unknown
  formData?: FormData
  headers?: Record<string, string>
  token?: string
  cookieToken?: string
  platform?: any
  ip?: string
  origin?: string
}

/** Build a minimal SvelteKit RequestEvent good enough for +server.ts handlers and services. */
export function makeEvent(opts: EventOpts = {}) {
  const origin = opts.origin ?? 'http://localhost:5173'
  const url = new URL((opts.path ?? '/') , origin)
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v)

  const headers = new Headers(opts.headers)
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`)
  let body: BodyInit | undefined
  if (opts.formData) body = opts.formData
  else if (opts.body !== undefined) {
    body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)
    headers.set('Content-Type', 'application/json')
  }

  const request = new Request(url, { method: opts.method ?? 'GET', headers, body })
  const cookies = makeCookies(opts.cookieToken ? { wordsvelte_token: opts.cookieToken } : {})
  return {
    request,
    url,
    params: opts.params ?? {},
    cookies,
    platform: opts.platform ?? { env: { JWT_SECRET } },
    getClientAddress: () => opts.ip ?? '1.2.3.4',
    locals: {},
  } as any
}

export function fakeR2() {
  const store = new Map<string, { body: Uint8Array; httpMetadata?: any }>()
  return {
    store,
    put: async (key: string, body: any, opts?: any) => { store.set(key, { body: new Uint8Array(body), httpMetadata: opts?.httpMetadata }) },
    get: async (key: string) => {
      const o = store.get(key)
      return o ? { body: o.body, httpMetadata: o.httpMetadata, text: async () => new TextDecoder().decode(o.body) } : null
    },
    delete: async (key: string) => { store.delete(key) },
    list: async ({ prefix }: { prefix?: string } = {}) => ({
      objects: [...store.keys()].filter(k => !prefix || k.startsWith(prefix)).map(key => ({ key })),
      truncated: false,
    }),
  }
}

export const withR2 = (r2 = fakeR2()) => ({ env: { JWT_SECRET, R2: r2 } })

export async function seedUser(role: 'admin' | 'editor' | 'author', n = Math.random().toString(36).slice(2, 8)) {
  const user = await createUser(getDb(), {
    email: `${role}-${n}@example.com`, username: `${role}_${n}`, password: 'correct-horse-battery', displayName: `${role} ${n}`, role,
  })
  const token = await createToken({ userId: user.id, role: user.role }, { platform: { env: { JWT_SECRET } } } as any)
  return { user, token }
}

/** Call a +server.ts handler and return status + parsed JSON body. */
export async function call(handler: (e: any) => Promise<Response> | Response, event: any) {
  const res = await handler(event)
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, json, text, headers: res.headers, res }
}

/** A tiny valid PNG (1x1). */
export const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
])
