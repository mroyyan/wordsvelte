import { describe, it, expect, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { passwordResets, users } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { createUser, validateLogin } from '$lib/server/services/account/user.service'
import {
  requestPasswordReset, resetPassword, isResetTokenValid, hashToken, RESET_TOKEN_TTL_MS,
} from '$lib/server/services/account/password-reset.service'
import { ResendMailer, ConsoleMailer, UnconfiguredMailer, getMailer, type Mailer, type MailMessage } from '$lib/server/mail/mailer'
import { ValidationError } from '$lib/server/core/errors'
import { POST as forgot } from '../../src/routes/api/auth/forgot-password/+server'
import { GET as checkToken, POST as reset } from '../../src/routes/api/auth/reset-password/+server'
import { call, makeEvent } from '../helpers/harness'

const OLD = 'old-password-123'
async function account(email = 'user@example.com') {
  return createUser(getDb(), { email, username: email.split('@')[0].replace(/\W/g, '_') + '_u', password: OLD, displayName: 'User', role: 'author' })
}
function spyMailer() {
  const sent: MailMessage[] = []
  const mailer: Mailer = { send: async m => { sent.push(m) } }
  return { mailer, sent }
}
const tokenFrom = (m: MailMessage) => m.text.match(/token=([0-9a-f]{64})/)![1]
const opts = (mailer: Mailer, now?: Date) => ({ origin: 'https://news.example.com', mailer, now })

describe('requestPasswordReset', () => {
  it('mails a one-time link, and stores only a hash of the token', async () => {
    const u = await account()
    const { mailer, sent } = spyMailer()
    await requestPasswordReset(getDb(), 'USER@example.com', opts(mailer))
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(u.email)
    expect(sent[0].text).toContain('https://news.example.com/admin/reset-password?token=')
    const token = tokenFrom(sent[0])
    const rows = await getDb().select().from(passwordResets)
    expect(rows).toHaveLength(1)
    expect(rows[0].tokenHash).toBe(await hashToken(token))
    expect(JSON.stringify(rows)).not.toContain(token)
  })

  it('does nothing (and says nothing) for unknown or empty addresses', async () => {
    await account()
    const { mailer, sent } = spyMailer()
    await requestPasswordReset(getDb(), 'ghost@example.com', opts(mailer))
    await requestPasswordReset(getDb(), '', opts(mailer))
    await requestPasswordReset(getDb(), undefined, opts(mailer))
    expect(sent).toHaveLength(0)
    expect(await getDb().select().from(passwordResets)).toHaveLength(0)
  })

  it('only the newest link works', async () => {
    await account()
    const { mailer, sent } = spyMailer()
    await requestPasswordReset(getDb(), 'user@example.com', opts(mailer))
    await requestPasswordReset(getDb(), 'user@example.com', opts(mailer))
    expect(await isResetTokenValid(getDb(), tokenFrom(sent[0]))).toBe(false)
    expect(await isResetTokenValid(getDb(), tokenFrom(sent[1]))).toBe(true)
    expect(await getDb().select().from(passwordResets)).toHaveLength(1)
  })

  it('a failing mail provider is swallowed (no account enumeration through errors)', async () => {
    await account()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken: Mailer = { send: async () => { throw new Error('smtp down') } }
    await expect(requestPasswordReset(getDb(), 'user@example.com', opts(broken))).resolves.toBeUndefined()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('resetPassword', () => {
  async function issue(now?: Date) {
    await account()
    const { mailer, sent } = spyMailer()
    await requestPasswordReset(getDb(), 'user@example.com', opts(mailer, now))
    return tokenFrom(sent[0])
  }

  it('sets the new password, consumes the link, and the old password stops working', async () => {
    const token = await issue()
    await resetPassword(getDb(), token, 'brand-new-password')
    await expect(validateLogin(getDb(), 'user@example.com', 'brand-new-password')).resolves.toMatchObject({ email: 'user@example.com' })
    await expect(validateLogin(getDb(), 'user@example.com', OLD)).rejects.toMatchObject({ status: 401 })
    expect(await isResetTokenValid(getDb(), token)).toBe(false)
    await expect(resetPassword(getDb(), token, 'another-new-password')).rejects.toBeInstanceOf(ValidationError) // single use
  })

  it('expires after one hour', async () => {
    const issued = new Date('2024-01-01T10:00:00Z')
    const token = await issue(issued)
    expect(await isResetTokenValid(getDb(), token, new Date(issued.getTime() + RESET_TOKEN_TTL_MS - 1000))).toBe(true)
    expect(await isResetTokenValid(getDb(), token, new Date(issued.getTime() + RESET_TOKEN_TTL_MS + 1000))).toBe(false)
    await expect(resetPassword(getDb(), token, 'brand-new-password', new Date(issued.getTime() + RESET_TOKEN_TTL_MS + 1000))).rejects.toBeInstanceOf(ValidationError)
    await expect(validateLogin(getDb(), 'user@example.com', OLD)).resolves.toBeTruthy() // unchanged
  })

  it.each([undefined, null, '', 'short', 'zz'.repeat(32), 'A'.repeat(64), '0'.repeat(63), 12345, {}, ['x']])('rejects malformed token %j', async t => {
    await issue()
    await expect(resetPassword(getDb(), t, 'brand-new-password')).rejects.toBeInstanceOf(ValidationError)
    expect(await isResetTokenValid(getDb(), t)).toBe(false)
  })

  it('rejects weak passwords without consuming the link', async () => {
    const token = await issue()
    await expect(resetPassword(getDb(), token, 'short')).rejects.toThrow(/at least 8/)
    await expect(resetPassword(getDb(), token, undefined)).rejects.toBeInstanceOf(ValidationError)
    expect(await isResetTokenValid(getDb(), token)).toBe(true)
  })

  it('a token for one user cannot change another user', async () => {
    const token = await issue()
    const other = await account('other@example.com')
    await resetPassword(getDb(), token, 'brand-new-password')
    await expect(validateLogin(getDb(), other.email, OLD)).resolves.toBeTruthy()
  })

  it('deleting the user removes their pending links', async () => {
    const token = await issue()
    await getDb().delete(users).where(eq(users.email, 'user@example.com'))
    expect(await isResetTokenValid(getDb(), token)).toBe(false)
  })
})

describe('mailers', () => {
  it('ResendMailer posts to the Resend API with a Bearer key and surfaces failures', async () => {
    const calls: any[] = []
    const ok = new ResendMailer('re_key', 'News <no-reply@example.com>', (async (url: any, init: any) => { calls.push({ url, init }); return new Response('{}', { status: 200 }) }) as any)
    await ok.send({ to: 'a@b.co', subject: 'S', text: 'T' })
    expect(calls[0].url).toBe('https://api.resend.com/emails')
    expect(calls[0].init.headers.Authorization).toBe('Bearer re_key')
    expect(JSON.parse(calls[0].init.body)).toMatchObject({ from: 'News <no-reply@example.com>', to: ['a@b.co'], subject: 'S', text: 'T' })
    const bad = new ResendMailer('k', 'f', (async () => new Response('no', { status: 422 })) as any)
    await expect(bad.send({ to: 'a@b.co', subject: 'S', text: 'T' })).rejects.toThrow(/422/)
  })

  it('getMailer: Resend when configured, console in dev, loud no-op in production', () => {
    expect(getMailer({ RESEND_API_KEY: 'k', MAIL_FROM: 'a@b.co' })).toBeInstanceOf(ResendMailer)
    expect(getMailer({ RESEND_API_KEY: 'k' })).toBeInstanceOf(ConsoleMailer) // incomplete config falls back (dev)
    expect(getMailer(undefined)).toBeInstanceOf(ConsoleMailer)
    vi.stubEnv('DEV', false)
    expect(getMailer(undefined)).toBeInstanceOf(UnconfiguredMailer)
    vi.unstubAllEnvs()
  })
})

describe('password reset API', () => {
  const ask = (email: unknown, ip = '1.2.3.4', env: object = {}) =>
    call(forgot, makeEvent({ method: 'POST', body: { email }, ip, platform: { env: { JWT_SECRET: 'test-secret-that-is-long-enough-123456', ...env } } }))

  it('gives the same answer for existing, unknown and malformed emails', async () => {
    await account()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const known = await ask('user@example.com')
    const unknown = await ask('ghost@example.com')
    const junk = await ask('not-an-email')
    expect([known.status, unknown.status, junk.status]).toEqual([200, 200, 200])
    expect(known.json).toEqual(unknown.json)
    expect(known.json).toEqual(junk.json)
    expect(await getDb().select().from(passwordResets)).toHaveLength(1)
    vi.restoreAllMocks()
  })

  it('400 for non-JSON bodies', async () => {
    expect((await call(forgot, makeEvent({ method: 'POST', body: '{nope' }))).status).toBe(400)
  })

  it('throttles repeated requests for one email (3) and one IP (10)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    for (let i = 0; i < 3; i++) expect((await ask('victim@example.com', `9.9.9.${i}`)).status).toBe(200)
    const blocked = await ask('victim@example.com', '9.9.9.77')
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0)
    for (let i = 0; i < 10; i++) await ask(`u${i}@example.com`, '8.8.8.8')
    expect((await ask('another@example.com', '8.8.8.8')).status).toBe(429)
    vi.restoreAllMocks()
  })

  it('full flow over HTTP: request -> check -> reset -> login', async () => {
    await account()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await ask('user@example.com')
    const printed = log.mock.calls.map(c => String(c[0])).join('\n') // dev ConsoleMailer prints the link
    const token = printed.match(/token=([0-9a-f]{64})/)![1]
    log.mockRestore()

    const check = (t: string) => call(checkToken, makeEvent({ query: { token: t } }))
    expect((await check(token)).json.data.valid).toBe(true)
    expect((await check('f'.repeat(64))).json.data.valid).toBe(false)
    expect((await check('')).json.data.valid).toBe(false)

    const bad = await call(reset, makeEvent({ method: 'POST', body: { token, password: 'short' } }))
    expect(bad.status).toBe(400)
    const done = await call(reset, makeEvent({ method: 'POST', body: { token, password: 'my-new-password' } }))
    expect(done.status).toBe(200)
    expect((await check(token)).json.data.valid).toBe(false)
    expect((await call(reset, makeEvent({ method: 'POST', body: { token, password: 'my-new-password-2' } }))).status).toBe(400)
    await expect(validateLogin(getDb(), 'user@example.com', 'my-new-password')).resolves.toBeTruthy()
  })

  it('reset endpoint is throttled per IP', async () => {
    let last = 0
    for (let i = 0; i < 21; i++) last = (await call(reset, makeEvent({ method: 'POST', body: { token: 'x', password: 'whatever-1' }, ip: '6.6.6.6' }))).status
    expect(last).toBe(429)
  })
})
