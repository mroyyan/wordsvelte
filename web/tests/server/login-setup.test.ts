import { describe, it, expect } from 'vitest'
import { getDb } from '$lib/server/db'
import { createUser } from '$lib/server/services/account/user.service'
import { POST as login } from '../../src/routes/api/auth/login/+server'
import { POST as logout } from '../../src/routes/api/auth/logout/+server'
import { GET as me } from '../../src/routes/api/auth/me/+server'
import { POST as setup, GET as setupStatus } from '../../src/routes/api/auth/setup/+server'
import { call, makeEvent, seedUser } from '../helpers/harness'

const creds = { email: 'admin@example.com', username: 'the_admin', password: 'correct-horse-battery', displayName: 'Admin' }

describe('POST /api/auth/login', () => {
  it('logs in, returns token + user (no hash) and sets the httpOnly cookie', async () => {
    await createUser(getDb(), { ...creds, role: 'admin' })
    const event = makeEvent({ method: 'POST', body: { email: 'ADMIN@example.com', password: creds.password } })
    const r = await call(login, event)
    expect(r.status).toBe(200)
    expect(r.json.data.user).toMatchObject({ email: 'admin@example.com', role: 'admin' })
    expect(r.text).not.toMatch(/passwordHash|password_hash/)
    expect(event.cookies.get('wordsvelte_token')).toBe(r.json.data.token)

    // the issued token actually works against /me
    const who = await call(me, makeEvent({ token: r.json.data.token }))
    expect(who.status).toBe(200)
    expect(who.json.data).toMatchObject({ role: 'admin', email: 'admin@example.com' })
  })

  it('same 401 body for wrong password and unknown email, and no cookie is set', async () => {
    await createUser(getDb(), { ...creds, role: 'admin' })
    const e1 = makeEvent({ method: 'POST', body: { email: creds.email, password: 'wrong-password' } })
    const e2 = makeEvent({ method: 'POST', body: { email: 'ghost@example.com', password: 'wrong-password' } })
    const [a, b] = [await call(login, e1), await call(login, e2)]
    expect(a.status).toBe(401)
    expect(b.status).toBe(401)
    expect(a.json).toEqual(b.json)
    expect(e1.cookies.get('wordsvelte_token')).toBeUndefined()
  })

  it.each([
    ['missing password', { email: 'a@b.co' }],
    ['missing email', { password: 'x' }],
    ['empty strings', { email: '', password: '' }],
    ['non-string email (object injection)', { email: { $ne: '' }, password: 'x' }],
    ['non-string password', { email: 'a@b.co', password: 12345678 }],
  ])('400 for %s', async (_n, body) => {
    expect((await call(login, makeEvent({ method: 'POST', body }))).status).toBe(400)
  })

  it('400 (not 500) for malformed JSON or non-object bodies', async () => {
    expect((await call(login, makeEvent({ method: 'POST', body: '{oops' }))).status).toBe(400)
    expect((await call(login, makeEvent({ method: 'POST', body: 'null' }))).status).toBe(400)
  })

  it('locks an email after 5 failures (429 + Retry-After), even for the right password', async () => {
    await createUser(getDb(), { ...creds, role: 'admin' })
    const attempt = (password: string, ip = '1.2.3.4') => call(login, makeEvent({ method: 'POST', body: { email: creds.email, password }, ip }))
    for (let i = 0; i < 5; i++) expect((await attempt('bad-password')).status).toBe(401)
    const blocked = await attempt(creds.password)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    // the lock follows the target email, not just the attacker IP
    expect((await attempt(creds.password, '9.9.9.9')).status).toBe(429)
  })

  it('a successful login resets the per-email counter', async () => {
    await createUser(getDb(), { ...creds, role: 'admin' })
    const attempt = (password: string) => call(login, makeEvent({ method: 'POST', body: { email: creds.email, password } }))
    for (let i = 0; i < 4; i++) await attempt('bad-password')
    expect((await attempt(creds.password)).status).toBe(200)
    for (let i = 0; i < 4; i++) expect((await attempt('bad-password')).status).toBe(401) // fresh budget
  })

  it('does not count other emails against a victim, but throttles one IP spraying many accounts', async () => {
    for (let i = 0; i < 30; i++) {
      const r = await call(login, makeEvent({ method: 'POST', body: { email: `user${i}@example.com`, password: 'x'.repeat(8) }, ip: '7.7.7.7' }))
      expect(r.status).toBe(401)
    }
    expect((await call(login, makeEvent({ method: 'POST', body: { email: 'user99@example.com', password: 'x'.repeat(8) }, ip: '7.7.7.7' }))).status).toBe(429)
    expect((await call(login, makeEvent({ method: 'POST', body: { email: 'user99@example.com', password: 'x'.repeat(8) }, ip: '8.8.8.8' }))).status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the cookie', async () => {
    const event = makeEvent({ method: 'POST', cookieToken: 'abc' })
    expect((await call(logout, event)).status).toBe(200)
    expect(event.cookies.get('wordsvelte_token')).toBeUndefined()
  })
})

describe('GET /api/auth/me', () => {
  it('401 anonymous, 401 invalid token', async () => {
    expect((await call(me, makeEvent())).status).toBe(401)
    expect((await call(me, makeEvent({ token: 'nope' }))).status).toBe(401)
  })
})

describe('first-run setup', () => {
  it('reports needsSetup until the first admin exists', async () => {
    expect((await call(setupStatus, makeEvent())).json.data.needsSetup).toBe(true)
    await call(setup, makeEvent({ method: 'POST', body: creds }))
    expect((await call(setupStatus, makeEvent())).json.data.needsSetup).toBe(false)
  })

  it('creates an admin, logs them in, and refuses a second setup (403)', async () => {
    const event = makeEvent({ method: 'POST', body: creds })
    const first = await call(setup, event)
    expect(first.status).toBe(201)
    expect(first.json.data.user.role).toBe('admin')
    expect(event.cookies.get('wordsvelte_token')).toBeTruthy()

    const again = await call(setup, makeEvent({ method: 'POST', body: { ...creds, email: 'evil@example.com', username: 'evil_admin' } }))
    expect(again.status).toBe(403)
  })

  it('validates input (weak password, bad email) without creating anyone', async () => {
    expect((await call(setup, makeEvent({ method: 'POST', body: { ...creds, password: 'short' } }))).status).toBe(400)
    expect((await call(setup, makeEvent({ method: 'POST', body: { ...creds, email: 'nope' } }))).status).toBe(400)
    expect((await call(setup, makeEvent({ method: 'POST', body: {} }))).status).toBe(400)
    expect((await call(setupStatus, makeEvent())).json.data.needsSetup).toBe(true)
  })

  it('cannot be used to mint another admin once a normal user exists', async () => {
    await seedUser('author')
    expect((await call(setup, makeEvent({ method: 'POST', body: creds }))).status).toBe(403)
  })
})
