import { describe, it, expect, vi, afterEach } from 'vitest'
import { SignJWT } from 'jose'
import { eq } from 'drizzle-orm'
import { users, settings } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { createToken, requireUser, getOptionalUser, hasRole, setAuthCookie, clearAuthCookie, AUTH_COOKIE, resetAuthCache } from '$lib/server/auth'
import { AuthError, ForbiddenError } from '$lib/server/core/errors'
import { makeEvent, makeCookies, seedUser, JWT_SECRET } from '../helpers/harness'

const enc = (s: string) => new TextEncoder().encode(s)

afterEach(() => { vi.unstubAllEnvs() })

describe('requireUser', () => {
  it('401 without any credentials', async () => {
    await expect(requireUser(makeEvent())).rejects.toBeInstanceOf(AuthError)
  })

  it('accepts a Bearer token and returns the DB-backed user', async () => {
    const { user, token } = await seedUser('editor')
    const me = await requireUser(makeEvent({ token }))
    expect(me).toMatchObject({ userId: user.id, role: 'editor', email: user.email, username: user.username })
  })

  it('accepts the auth cookie too', async () => {
    const { user, token } = await seedUser('author')
    const me = await requireUser(makeEvent({ cookieToken: token }))
    expect(me.userId).toBe(user.id)
  })

  it('rejects garbage, truncated and tampered tokens', async () => {
    const { token } = await seedUser('admin')
    for (const bad of ['garbage', token.slice(0, -4), token.replace(/.$/, c => (c === 'a' ? 'b' : 'a')), '']) {
      await expect(requireUser(makeEvent({ token: bad || undefined, headers: bad ? {} : { Authorization: 'Bearer ' } }))).rejects.toBeInstanceOf(AuthError)
    }
  })

  it('rejects a token signed with a different secret', async () => {
    const { user } = await seedUser('admin')
    const forged = await new SignJWT({ userId: user.id, role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(enc('another-secret-another-secret-123'))
    await expect(requireUser(makeEvent({ token: forged }))).rejects.toBeInstanceOf(AuthError)
  })

  it('rejects an unsigned (alg: none) token', async () => {
    const { user } = await seedUser('admin')
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: user.id, role: 'admin' })}.`
    await expect(requireUser(makeEvent({ token: none }))).rejects.toBeInstanceOf(AuthError)
  })

  it('rejects tokens signed with a non-HS256 HMAC algorithm', async () => {
    const { user } = await seedUser('admin')
    const hs512 = await new SignJWT({ userId: user.id }).setProtectedHeader({ alg: 'HS512' }).setExpirationTime('1h').sign(enc(JWT_SECRET))
    await expect(requireUser(makeEvent({ token: hs512 }))).rejects.toBeInstanceOf(AuthError)
  })

  it('rejects expired tokens', async () => {
    const { user } = await seedUser('admin')
    const expired = await new SignJWT({ userId: user.id, role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(enc(JWT_SECRET))
    await expect(requireUser(makeEvent({ token: expired }))).rejects.toBeInstanceOf(AuthError)
  })

  it('rejects tokens whose userId is not a number', async () => {
    const t = await new SignJWT({ userId: '1', role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(enc(JWT_SECRET))
    await expect(requireUser(makeEvent({ token: t }))).rejects.toBeInstanceOf(AuthError)
  })

  it('rejects a valid token once the user has been deleted', async () => {
    const { user, token } = await seedUser('author')
    await getDb().delete(users).where(eq(users.id, user.id))
    await expect(requireUser(makeEvent({ token }))).rejects.toBeInstanceOf(AuthError)
  })

  it('uses the CURRENT database role, not the role baked into the token', async () => {
    const { user, token } = await seedUser('admin')
    await requireUser(makeEvent({ token }), 'admin') // fine while admin
    await getDb().update(users).set({ role: 'author' }).where(eq(users.id, user.id))
    await expect(requireUser(makeEvent({ token }), 'admin')).rejects.toBeInstanceOf(ForbiddenError)
    expect((await requireUser(makeEvent({ token }), 'author')).role).toBe('author')
  })

  it('a token claiming admin cannot escalate a lower-privileged DB user', async () => {
    const { user } = await seedUser('author')
    const claimsAdmin = await createToken({ userId: user.id, role: 'admin' }, { platform: { env: { JWT_SECRET } } } as any)
    await expect(requireUser(makeEvent({ token: claimsAdmin }), 'admin')).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('rejects users whose stored role is not a known role', async () => {
    const { user, token } = await seedUser('author')
    await getDb().update(users).set({ role: 'superuser' }).where(eq(users.id, user.id))
    await expect(requireUser(makeEvent({ token }))).rejects.toBeInstanceOf(AuthError)
  })
})

describe('role hierarchy', () => {
  it.each([
    ['author', 'author', true], ['author', 'editor', false], ['author', 'admin', false],
    ['editor', 'author', true], ['editor', 'editor', true], ['editor', 'admin', false],
    ['admin', 'author', true], ['admin', 'editor', true], ['admin', 'admin', true],
  ] as const)('%s vs required %s -> allowed=%s', async (have, need, allowed) => {
    const { token } = await seedUser(have)
    const attempt = requireUser(makeEvent({ token }), need)
    if (allowed) await expect(attempt).resolves.toMatchObject({ role: have })
    else await expect(attempt).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('hasRole compares ranks', () => {
    expect(hasRole({ role: 'admin' }, 'editor')).toBe(true)
    expect(hasRole({ role: 'author' }, 'editor')).toBe(false)
  })
})

describe('getOptionalUser', () => {
  it('returns null for anonymous and invalid tokens, the user otherwise', async () => {
    expect(await getOptionalUser(makeEvent())).toBeNull()
    expect(await getOptionalUser(makeEvent({ token: 'nope' }))).toBeNull()
    const { token, user } = await seedUser('author')
    expect((await getOptionalUser(makeEvent({ token })))?.userId).toBe(user.id)
  })
})

describe('JWT secret handling', () => {
  const noSecretEvent = (extra: object = {}) => makeEvent({ platform: { env: {} }, ...extra })

  it('dev: falls back to a random secret persisted in the DB and reuses it', async () => {
    const { user } = await seedUser('admin')
    const t1 = await createToken({ userId: user.id, role: 'admin' }, noSecretEvent())
    const rows = await getDb().select().from(settings).where(eq(settings.key, 'jwt_secret'))
    expect(rows[0].value).toMatch(/^[0-9a-f]{64}$/)
    resetAuthCache() // simulate a new isolate: must read the same secret back from the DB
    expect((await requireUser(noSecretEvent({ token: t1 }))).userId).toBe(user.id)
  })

  it.each(['change-me-in-production', 'changeme', 'short'])('ignores weak/placeholder platform secret %j', async weak => {
    const { user } = await seedUser('admin')
    const viaWeak = await createToken({ userId: user.id, role: 'admin' }, makeEvent({ platform: { env: { JWT_SECRET: weak } } }))
    // A weak secret must not be used for signing: token validates against the DB-secret path, not against the weak one.
    const forged = await new SignJWT({ userId: user.id, role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(enc(weak))
    await expect(requireUser(makeEvent({ platform: { env: { JWT_SECRET: weak } }, token: forged }))).rejects.toBeInstanceOf(AuthError)
    expect((await requireUser(makeEvent({ platform: { env: {} }, token: viaWeak }))).userId).toBe(user.id)
  })

  it('production: refuses to run without a proper JWT_SECRET (fail closed, never store one in the DB)', async () => {
    vi.stubEnv('DEV', false)
    const { user } = await seedUser('admin')
    await expect(createToken({ userId: user.id, role: 'admin' }, noSecretEvent())).rejects.toThrow(/JWT_SECRET is not configured/)
    await expect(requireUser(noSecretEvent({ token: 'whatever' }))).rejects.toThrow(/JWT_SECRET is not configured/)
    const rows = await getDb().select().from(settings).where(eq(settings.key, 'jwt_secret'))
    expect(rows).toHaveLength(0)
  })

  it('production: a configured secret works normally', async () => {
    vi.stubEnv('DEV', false)
    const { user } = await seedUser('editor')
    const t = await createToken({ userId: user.id, role: 'editor' }, makeEvent())
    expect((await requireUser(makeEvent({ token: t }))).role).toBe('editor')
  })
})

describe('auth cookie helpers', () => {
  it('sets an httpOnly, SameSite=Lax cookie; secure only over https', () => {
    const calls: any[] = []
    const cookies = { set: (...a: any[]) => calls.push(a), delete: vi.fn() } as any
    setAuthCookie({ cookies, url: new URL('https://x.test') } as any, 'tok')
    setAuthCookie({ cookies, url: new URL('http://localhost') } as any, 'tok')
    expect(calls[0][0]).toBe(AUTH_COOKIE)
    expect(calls[0][2]).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 604800 })
    expect(calls[1][2].secure).toBe(false)
  })

  it('clearAuthCookie deletes on the root path', () => {
    const cookies = makeCookies({ [AUTH_COOKIE]: 'x' })
    clearAuthCookie({ cookies } as any)
    expect(cookies.get(AUTH_COOKIE)).toBeUndefined()
  })
})
