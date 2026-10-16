import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { settings, users } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { call, makeEvent, seedUser, JWT_SECRET } from '../helpers/harness'
import { startFakeSmtp } from '../helpers/fake-smtp'
import { totpAt } from '../../src/lib/server/auth/two-factor/totp'
import * as login from '../../src/routes/api/auth/login/+server'
import * as twofa from '../../src/routes/api/auth/2fa/+server'
import * as me from '../../src/routes/api/auth/me/+server'
import * as account from '../../src/routes/api/account/+server'
import * as password from '../../src/routes/api/account/password/+server'
import * as account2fa from '../../src/routes/api/account/2fa/+server'
import * as smtp from '../../src/routes/api/settings/smtp/+server'
import * as smtpTest from '../../src/routes/api/settings/smtp/test/+server'
import * as settingsRoute from '../../src/routes/api/settings/+server'
import { requestPasswordReset, resetPassword } from '../../src/lib/server/services/account/password-reset.service'
import { resetAuthCache } from '$lib/server/auth'

type Server = Awaited<ReturnType<typeof startFakeSmtp>>
let server: Server | undefined
afterEach(async () => { await server?.close(); server = undefined })
beforeEach(() => resetAuthCache())

const ev = (o: object = {}) => makeEvent({ platform: { env: { JWT_SECRET } }, ...o })
const post = (handler: any, token: string | undefined, body: object, extra: object = {}) => call(handler, ev({ method: 'POST', token, body, ...extra }))
const act = (token: string, body: object) => post(account2fa.POST, token, body)
const PASSWORD = 'correct-horse-battery'

async function configureSmtp(adminToken: string, s: Server, extra: object = {}) {
  const r = await call(smtp.PUT, ev({ method: 'PUT', token: adminToken, body: { host: 'localhost', port: s.port, encryption: 'none', fromEmail: 'news@example.com', fromName: 'Portal', ...extra } }))
  expect(r.status, r.text).toBe(200)
  return r
}
const lastCode = (s: Server) => {
  const mail = s.mails.at(-1)!
  const body = Buffer.from(mail.data.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8')
  return /\b(\d{6})\b/.exec(body)![1]
}
const doLogin = (u: { user: { email: string } }) => call(login.POST, ev({ method: 'POST', body: { email: u.user.email, password: PASSWORD } }))

describe('SMTP settings', () => {
  it('stores the password encrypted, never returns it, and keeps it out of the generic settings API', async () => {
    server = await startFakeSmtp({ auth: { user: 'mailer', pass: 'hunter2-secret' } })
    const admin = await seedUser('admin')
    const saved = await configureSmtp(admin.token, server, { username: 'mailer', password: 'hunter2-secret' })
    expect(saved.json.data).toMatchObject({ host: 'localhost', passwordSet: true, configured: true })
    expect(saved.text).not.toContain('hunter2-secret')

    const raw = await getDb().select().from(settings).where(eq(settings.key, 'smtp_password'))
    expect(raw[0].value).toMatch(/^v1\./)
    expect(raw[0].value).not.toContain('hunter2')

    const all = await call(settingsRoute.GET, ev({ token: admin.token }))
    expect(Object.keys(all.json.data).filter(k => k.startsWith('smtp_'))).toEqual([])
    const sneaky = await call(settingsRoute.PUT, ev({ method: 'PUT', token: admin.token, body: { smtp_host: 'evil.example.com' } }))
    expect(sneaky.status).toBe(400)

    // Saving again without a password keeps the stored one
    await configureSmtp(admin.token, server, { username: 'mailer', fromName: 'Renamed' })
    const sent = await post(smtpTest.POST, admin.token, {})
    expect(sent.status, sent.text).toBe(200)
    expect(server.mails.at(-1)).toMatchObject({ authed: true, to: [admin.user.email] })
  })

  it('validates input and refuses a login over an unencrypted remote connection', async () => {
    const admin = await seedUser('admin')
    const put = (body: object) => call(smtp.PUT, ev({ method: 'PUT', token: admin.token, body }))
    const good = { host: 'smtp.example.com', port: 587, encryption: 'starttls', fromEmail: 'a@example.com' }
    expect((await put({ ...good, host: 'bad host!' })).status).toBe(400)
    expect((await put({ ...good, port: 70000 })).status).toBe(400)
    expect((await put({ ...good, encryption: 'rot13' })).status).toBe(400)
    expect((await put({ ...good, fromEmail: 'nope' })).status).toBe(400)
    expect((await put({ ...good, encryption: 'none', username: 'u', password: 'p' })).status).toBe(400)
    expect((await put({ ...good, username: 'u' })).status).toBe(400) // username without a password
    expect((await put(good)).status).toBe(200)
    expect((await put({ host: '' })).json.data.configured).toBe(false) // empty host switches it off
  })

  it('reports a readable error when the server rejects the login', async () => {
    server = await startFakeSmtp({ auth: { user: 'mailer', pass: 'right' } })
    const admin = await seedUser('admin')
    await configureSmtp(admin.token, server, { username: 'mailer', password: 'wrong' })
    const r = await post(smtpTest.POST, admin.token, {})
    expect(r.status).toBe(502)
    expect(r.json.error).toMatch(/Login failed/)
  })
})

describe('change password and profile', () => {
  it('needs the current password, ends other sessions, keeps this one', async () => {
    const u = await seedUser('editor')
    const bad = await post(password.POST, u.token, { currentPassword: 'wrong-password', newPassword: 'another-good-pass' })
    expect(bad.status).toBe(403)
    expect((await post(password.POST, u.token, { currentPassword: PASSWORD, newPassword: 'short' })).status).toBe(400)
    expect((await post(password.POST, u.token, { currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400)

    const ok = await post(password.POST, u.token, { currentPassword: PASSWORD, newPassword: 'another-good-pass' })
    expect(ok.status, ok.text).toBe(200)
    expect((await call(me.GET, ev({ token: u.token }))).status).toBe(401) // the old token is dead
    expect((await call(me.GET, ev({ token: ok.json.data.token }))).status).toBe(200) // the fresh one works
    const again = await call(login.POST, ev({ method: 'POST', body: { email: u.user.email, password: 'another-good-pass' } }))
    expect(again.status).toBe(200)
    expect((await call(me.GET, ev({ token: again.json.data.token }))).status).toBe(200)
  })

  it('is closed to anonymous callers', async () => {
    expect((await post(password.POST, undefined, { currentPassword: PASSWORD, newPassword: 'another-good-pass' })).status).toBe(401)
  })

  it('locks out guessing of the current password', async () => {
    const u = await seedUser('author')
    for (let i = 0; i < 8; i++) await post(password.POST, u.token, { currentPassword: `wrong-${i}-password`, newPassword: 'another-good-pass' })
    const r = await post(password.POST, u.token, { currentPassword: PASSWORD, newPassword: 'another-good-pass' })
    expect(r.status).toBe(429)
  })

  it('a password reset signs out existing sessions', async () => {
    const u = await seedUser('author')
    let link = ''
    await requestPasswordReset(getDb(), u.user.email, { origin: 'https://x.test', mailer: { send: async m => { link = m.text } } })
    const token = /token=([0-9a-f]{64})/.exec(link)![1]
    await resetPassword(getDb(), token, 'brand-new-password')
    expect((await call(me.GET, ev({ token: u.token }))).status).toBe(401)
  })

  it('updates the display name freely but the email only with the password', async () => {
    const u = await seedUser('author')
    const patch = (body: object) => call(account.PATCH, ev({ method: 'PATCH', token: u.token, body }))
    expect((await patch({ displayName: 'Nama Baru' })).json.data.displayName).toBe('Nama Baru')
    expect((await patch({ displayName: '   ' })).status).toBe(400)
    expect((await patch({ email: 'new@example.com' })).status).toBe(403)
    expect((await patch({ email: 'new@example.com', currentPassword: PASSWORD })).json.data.email).toBe('new@example.com')
    const other = await seedUser('author')
    expect((await patch({ email: other.user.email, currentPassword: PASSWORD })).status).toBe(409)
  })
})

describe('authenticator app (TOTP)', () => {
  async function enableTotp() {
    const u = await seedUser('admin')
    const setup = await act(u.token, { action: 'totp-setup' })
    expect(setup.status, setup.text).toBe(200)
    expect(setup.json.data.qrSvg).toContain('<svg')
    expect(setup.json.data.uri).toMatch(/^otpauth:\/\/totp\//)
    const code = await totpAt(setup.json.data.secret, Date.now())
    const confirm = await act(u.token, { action: 'totp-confirm', code })
    expect(confirm.status, confirm.text).toBe(200)
    return { u, seed: setup.json.data.secret as string, recovery: confirm.json.data.recoveryCodes as string[], usedStep: code }
  }

  it('sets up, requires the second step at login, and does not allow replay', async () => {
    const { u, seed, recovery } = await enableTotp()
    expect(recovery).toHaveLength(10)
    const stored = await getDb().select().from(users).where(eq(users.id, u.user.id))
    expect(stored[0].totpSecret).toMatch(/^v1\./)
    expect(stored[0].totpSecret).not.toContain(seed)

    const first = await doLogin(u)
    expect(first.status).toBe(200)
    expect(first.json.data.token).toBeUndefined()
    expect(first.json.data.twoFactor.methods).toEqual(['totp', 'recovery'])
    const challenge = first.json.data.twoFactor.challenge as string
    // the challenge is not a session
    expect((await call(me.GET, ev({ token: challenge }))).status).toBe(401)
    expect((await post(twofa.POST, undefined, { challenge: 'garbage', method: 'totp', code: '123456' })).status).toBe(401)

    const good = await totpAt(seed, Date.now() + 30_000) // next step: the earlier code is already used
    const done = await post(twofa.POST, undefined, { challenge, method: 'totp', code: good })
    expect(done.status, done.text).toBe(200)
    expect((await call(me.GET, ev({ token: done.json.data.token }))).status).toBe(200)

    const replay = await post(twofa.POST, undefined, { challenge, method: 'totp', code: good })
    expect(replay.status).toBe(401)
  })

  it('rejects wrong codes and locks out after repeated failures', async () => {
    const { u, seed } = await enableTotp()
    const { challenge } = (await doLogin(u)).json.data.twoFactor
    for (let i = 0; i < 8; i++) expect((await post(twofa.POST, undefined, { challenge, method: 'totp', code: '000000' })).status).toBe(401)
    const locked = await post(twofa.POST, undefined, { challenge, method: 'totp', code: await totpAt(seed, Date.now() + 30_000) })
    expect(locked.status).toBe(429)
  })

  it('recovery codes work exactly once', async () => {
    const { u, recovery } = await enableTotp()
    const { challenge } = (await doLogin(u)).json.data.twoFactor
    expect((await post(twofa.POST, undefined, { challenge, method: 'recovery', code: recovery[0] })).status).toBe(200)
    expect((await post(twofa.POST, undefined, { challenge, method: 'recovery', code: recovery[0] })).status).toBe(401)
    expect((await post(twofa.POST, undefined, { challenge, method: 'recovery', code: recovery[1].toLowerCase().replace(/-/g, ' ') })).status).toBe(200)
    expect((await call(account2fa.GET, ev({ token: u.token }))).json.data.recoveryCodesRemaining).toBe(8)
  })

  it('turning it off needs the password, ends sessions, and restores plain login', async () => {
    const { u } = await enableTotp()
    expect((await act(u.token, { action: 'totp-disable', password: 'nope-nope-nope' })).status).toBe(403)
    expect((await act(u.token, { action: 'totp-disable', password: PASSWORD })).status).toBe(200)
    expect((await call(me.GET, ev({ token: u.token }))).status).toBe(401)
    const r = await doLogin(u)
    expect(r.json.data.token).toBeTruthy()
  })

  it('refuses to confirm without a started setup and with a wrong code', async () => {
    const u = await seedUser('author')
    expect((await act(u.token, { action: 'totp-confirm', code: '123456' })).status).toBe(400)
    await act(u.token, { action: 'totp-setup' })
    expect((await act(u.token, { action: 'totp-confirm', code: '000000' })).status).toBe(400)
    expect((await call(account2fa.GET, ev({ token: u.token }))).json.data).toMatchObject({ totpEnabled: false, totpPending: true })
  })

  it('a challenge becomes useless after the password changes', async () => {
    const { u } = await enableTotp()
    const { challenge } = (await doLogin(u)).json.data.twoFactor
    await post(password.POST, u.token, { currentPassword: PASSWORD, newPassword: 'another-good-pass' })
    expect((await post(twofa.POST, undefined, { challenge, method: 'recovery', code: 'x' })).status).toBe(401)
  })
})

describe('email codes', () => {
  it('turns on after confirming a mailed code, then protects login', async () => {
    server = await startFakeSmtp()
    const u = await seedUser('admin')
    await configureSmtp(u.token, server)

    expect((await act(u.token, { action: 'email-send' })).status).toBe(200)
    expect(server.mails).toHaveLength(1)
    expect((await act(u.token, { action: 'email-confirm', code: '000000' })).status).toBe(400)
    const enabled = await act(u.token, { action: 'email-confirm', code: lastCode(server) })
    expect(enabled.status, enabled.text).toBe(200)
    expect(enabled.json.data.recoveryCodes).toHaveLength(10)

    server.mails.length = 0
    const first = await doLogin(u)
    expect(first.json.data.twoFactor).toMatchObject({ methods: ['email', 'recovery'], emailSent: true })
    expect(server.mails).toHaveLength(1)
    expect(server.mails[0].to).toEqual([u.user.email])
    const code = lastCode(server)
    const challenge = first.json.data.twoFactor.challenge

    expect((await post(twofa.POST, undefined, { challenge, method: 'email', code: code === '111111' ? '222222' : '111111' })).status).toBe(401)
    const done = await post(twofa.POST, undefined, { challenge, method: 'email', code })
    expect(done.status, done.text).toBe(200)
    // single use
    expect((await post(twofa.POST, undefined, { challenge, method: 'email', code })).status).toBe(401)
  })

  it('a code dies after too many wrong attempts, even if the right one is then entered', async () => {
    server = await startFakeSmtp()
    const u = await seedUser('admin')
    await configureSmtp(u.token, server)
    await act(u.token, { action: 'email-send' })
    const real = lastCode(server)
    for (let i = 0; i < 5; i++) await act(u.token, { action: 'email-confirm', code: real === '999999' ? '888888' : '999999' })
    expect((await act(u.token, { action: 'email-confirm', code: real })).status).toBeGreaterThanOrEqual(400)
  })

  it('does not enable when the email cannot be sent', async () => {
    const u = await seedUser('admin') // no SMTP configured; dev console mailer would swallow it, so break it explicitly
    server = await startFakeSmtp()
    await configureSmtp(u.token, server)
    const port = server.port
    await server.close(); server = undefined
    const r = await act(u.token, { action: 'email-send' })
    expect(r.status).toBe(502)
    expect(port).toBeGreaterThan(0)
    expect((await call(account2fa.GET, ev({ token: u.token }))).json.data.email2faEnabled).toBe(false)
  })

  it('email-only sign-in falls back to recovery codes when mail is down', async () => {
    server = await startFakeSmtp()
    const u = await seedUser('admin')
    await configureSmtp(u.token, server)
    await act(u.token, { action: 'email-send' })
    const enabled = await act(u.token, { action: 'email-confirm', code: lastCode(server) })
    await server.close(); server = undefined
    const first = await doLogin(u)
    expect(first.status).toBe(200)
    expect(first.json.data.twoFactor.emailSent).toBe(false)
    const done = await post(twofa.POST, undefined, { challenge: first.json.data.twoFactor.challenge, method: 'recovery', code: enabled.json.data.recoveryCodes[0] })
    expect(done.status).toBe(200)
  })
})

describe('recovery code regeneration', () => {
  it('needs 2FA to be on and the password, and replaces the old codes', async () => {
    const u = await seedUser('admin')
    expect((await act(u.token, { action: 'recovery-regenerate', password: PASSWORD })).status).toBe(400)
    const setup = await act(u.token, { action: 'totp-setup' })
    const confirm = await act(u.token, { action: 'totp-confirm', code: await totpAt(setup.json.data.secret, Date.now()) })
    const old = confirm.json.data.recoveryCodes[0]
    expect((await act(u.token, { action: 'recovery-regenerate', password: 'wrong-password' })).status).toBe(403)
    const fresh = await act(u.token, { action: 'recovery-regenerate', password: PASSWORD })
    expect(fresh.json.data.recoveryCodes).toHaveLength(10)
    const { challenge } = (await doLogin(u)).json.data.twoFactor
    expect((await post(twofa.POST, undefined, { challenge, method: 'recovery', code: old })).status).toBe(401)
    expect((await post(twofa.POST, undefined, { challenge, method: 'recovery', code: fresh.json.data.recoveryCodes[0] })).status).toBe(200)
  })
})
