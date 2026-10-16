import { afterEach, describe, expect, it } from 'vitest'
import { sendViaSmtp, SmtpError, type SmtpConfig } from '../../src/lib/server/mail/smtp/client'
import { assertAddress, buildMessage, dotStuff, encodeHeaderText, formatAddress } from '../../src/lib/server/mail/smtp/message'
import { nodeConnector } from '../../src/lib/server/mail/smtp/node-transport'
import { startFakeSmtp } from '../helpers/fake-smtp'

const connector = nodeConnector({ rejectUnauthorized: false })
let server: Awaited<ReturnType<typeof startFakeSmtp>> | undefined
afterEach(async () => { await server?.close(); server = undefined })

const cfg = (port: number, extra: Partial<SmtpConfig> = {}): SmtpConfig => ({
  host: 'localhost', port, encryption: 'none', fromEmail: 'news@example.com', fromName: 'My Portal', timeoutMs: 3000, ...extra,
})
const msg = { to: 'reader@example.org', subject: 'Hello', text: 'Line one\n.starts with a dot\nend' }
const decodeBody = (data: string) => Buffer.from(data.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8')

describe('message building', () => {
  it('rejects addresses that could inject headers or commands', () => {
    for (const bad of ['a@b.com\r\nBcc: x@y.com', 'a@b.com>\r\nRCPT TO:<x@y.com', 'no-at-sign', 'a b@c.com', '', 'a@b', '<a@b.com>', 'a@b.com,c@d.com']) {
      expect(() => assertAddress(bad), bad).toThrow()
    }
    expect(assertAddress(' user+tag@sub.example.com ')).toBe('user+tag@sub.example.com')
  })

  it('encodes non-ASCII subjects and names, never leaving a raw newline', () => {
    const subject = encodeHeaderText('Berita Terkini: Pemilu \u{1F5F3} dan seterusnya yang sangat panjang sekali sampai harus dipotong beberapa kali')
    expect(subject).toMatch(/^=\?UTF-8\?B\?/)
    for (const w of subject.split('\r\n ')) expect(Buffer.from(w.slice(10, -2), 'base64').toString('utf8')).not.toContain('�')
    expect(encodeHeaderText('Hi\r\nBcc: evil@x.com')).toBe('Hi Bcc: evil@x.com')
    expect(formatAddress({ email: 'a@b.com', name: 'Evil"\r\nBcc: x' })).not.toMatch(/[\r\n]/)
  })

  it('builds text-only and multipart messages', () => {
    const t = buildMessage({ from: { email: 'a@b.com' }, to: 'c@d.com', subject: 'S', text: 'hi' })
    expect(t).toContain('Content-Type: text/plain; charset=utf-8')
    const m = buildMessage({ from: { email: 'a@b.com' }, to: 'c@d.com', subject: 'S', text: 'hi', html: '<p>hi</p>' })
    expect(m).toContain('multipart/alternative')
    expect(m).toContain('text/html')
  })

  it('dot-stuffs lines that start with a dot', () => {
    expect(dotStuff('a\r\n.b\r\n..c')).toBe('a\r\n..b\r\n...c')
  })
})

describe('SMTP client', () => {
  it('delivers over a plain connection and preserves leading dots', async () => {
    server = await startFakeSmtp()
    await sendViaSmtp(cfg(server.port), msg, connector)
    expect(server.mails).toHaveLength(1)
    expect(server.mails[0]).toMatchObject({ from: 'news@example.com', to: ['reader@example.org'] })
    expect(decodeBody(server.mails[0].data)).toBe('Line one\r\n.starts with a dot\r\nend')
  })

  it('upgrades with STARTTLS, re-announces, and authenticates only afterwards', async () => {
    server = await startFakeSmtp({ starttls: true, auth: { user: 'u', pass: 'p' } })
    await sendViaSmtp(cfg(server.port, { encryption: 'starttls', username: 'u', password: 'p' }), msg, connector)
    expect(server.mails[0]).toMatchObject({ authed: true, tls: true })
    const order = server.commands.map(c => c.split(' ')[0])
    expect(order.indexOf('STARTTLS')).toBeLessThan(order.indexOf('AUTH'))
    expect(order.filter(c => c === 'EHLO')).toHaveLength(2)
  })

  it('works over implicit TLS with AUTH LOGIN', async () => {
    server = await startFakeSmtp({ mode: 'tls', auth: { user: 'u', pass: 'p' }, mechanisms: 'LOGIN' })
    await sendViaSmtp(cfg(server.port, { encryption: 'tls', username: 'u', password: 'p' }), msg, connector)
    expect(server.mails[0]).toMatchObject({ authed: true, tls: true })
  })

  it('refuses to send a password over an unencrypted remote connection', async () => {
    let connected = false
    const spy = (async () => { connected = true; throw new Error('should not connect') }) as unknown as typeof connector
    await expect(sendViaSmtp(cfg(25, { host: 'smtp.example.com', username: 'u', password: 'p' }), msg, spy)).rejects.toThrow(/without encryption/)
    expect(connected).toBe(false)
  })

  it('reports a clear error for wrong credentials without leaking the password', async () => {
    server = await startFakeSmtp({ auth: { user: 'u', pass: 'right' } })
    const err = await sendViaSmtp(cfg(server.port, { username: 'u', password: 'wrong-secret' }), msg, connector).catch(e => e)
    expect(err).toBeInstanceOf(SmtpError)
    expect(err.message).toMatch(/Login failed/)
    expect(err.message).not.toContain('wrong-secret')
    expect(err.step).toBe('AUTH')
  })

  it('reports a rejected recipient', async () => {
    server = await startFakeSmtp({ rejectRcpt: ['reader@example.org'] })
    await expect(sendViaSmtp(cfg(server.port), msg, connector)).rejects.toThrow(/RCPT TO was refused: 550/)
    expect(server.mails).toHaveLength(0)
  })

  it('fails clearly when STARTTLS is requested but not offered', async () => {
    server = await startFakeSmtp()
    await expect(sendViaSmtp(cfg(server.port, { encryption: 'starttls' }), msg, connector)).rejects.toThrow(/does not offer STARTTLS/)
  })

  it('fails clearly when nothing is listening', async () => {
    server = await startFakeSmtp()
    const port = server.port
    await server.close(); server = undefined
    await expect(sendViaSmtp(cfg(port), msg, connector)).rejects.toThrow(/Could not connect/)
  })

  it('times out against a server that never answers', async () => {
    const { createServer } = await import('node:net')
    const silent = createServer(() => {})
    await new Promise<void>(r => silent.listen(0, '127.0.0.1', r))
    const port = (silent.address() as import('node:net').AddressInfo).port
    await expect(sendViaSmtp(cfg(port, { timeoutMs: 300 }), msg, connector)).rejects.toThrow(/Timed out/)
    silent.close(); (silent as any).closeAllConnections?.()
  })

  it('does not let a malicious recipient smuggle extra SMTP commands', async () => {
    server = await startFakeSmtp()
    await expect(sendViaSmtp(cfg(server.port), { ...msg, to: 'a@b.com>\r\nRCPT TO:<x@y.com' }, connector)).rejects.toThrow()
    expect(server.commands).toHaveLength(0)
  })

  it('sends UTF-8 subjects and bodies intact', async () => {
    server = await startFakeSmtp()
    await sendViaSmtp(cfg(server.port), { to: 'r@example.org', subject: 'Kode masuk ✓', text: 'Halo 世界' }, connector)
    expect(server.mails[0].data).toMatch(/Subject: =\?UTF-8\?B\?/)
    expect(decodeBody(server.mails[0].data)).toBe('Halo 世界')
  })
})
