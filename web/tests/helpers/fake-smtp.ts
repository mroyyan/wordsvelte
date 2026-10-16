import net from 'node:net'
import tls from 'node:tls'
import { TEST_CERT, TEST_KEY } from './test-cert'

export interface FakeSmtpOptions {
  mode?: 'plain' | 'tls'
  /** Advertise STARTTLS (plain mode only). */
  starttls?: boolean
  /** Require this username/password (PLAIN or LOGIN); otherwise AUTH is not offered. */
  auth?: { user: string; pass: string }
  /** Reject these recipients with 550. */
  rejectRcpt?: string[]
  /** Advertised AUTH mechanisms. */
  mechanisms?: string
}

export interface ReceivedMail { from: string; to: string[]; data: string; authed: boolean; tls: boolean }

export async function startFakeSmtp(opts: FakeSmtpOptions = {}) {
  const mails: ReceivedMail[] = []
  const commands: string[] = []
  const ctx = tls.createSecureContext({ key: TEST_KEY, cert: TEST_CERT })

  const handle = (raw: net.Socket, secure: boolean) => {
    let sock: net.Socket = raw
    let isTls = secure
    let authed = false
    let buffer = ''
    let inData = false
    let authStep: 'user' | 'pass' | null = null
    let loginUser = ''
    let from = ''
    let to: string[] = []
    let data = ''

    const send = (s: string) => sock.write(s + '\r\n')
    const caps = () => {
      const c = ['250-fake.local']
      if (opts.starttls && !isTls) c.push('250-STARTTLS')
      if (opts.auth) c.push(`250-AUTH ${opts.mechanisms ?? 'PLAIN LOGIN'}`)
      c.push('250 8BITMIME')
      return c.join('\r\n')
    }
    const checkAuth = (u: string, p: string) => !opts.auth || (u === opts.auth.user && p === opts.auth.pass)
    const dec = (b: string) => Buffer.from(b, 'base64').toString('utf8')

    const onLine = (line: string) => {
      if (authStep) {
        if (authStep === 'user') { loginUser = dec(line); authStep = 'pass'; return send('334 UGFzc3dvcmQ6') }
        authStep = null
        authed = checkAuth(loginUser, dec(line))
        return send(authed ? '235 ok' : '535 5.7.8 bad credentials')
      }
      commands.push(line.startsWith('AUTH') ? line.split(' ').slice(0, 2).join(' ') : line)
      const cmd = line.toUpperCase()
      if (cmd.startsWith('EHLO')) return send(caps())
      if (cmd === 'STARTTLS') {
        send('220 go ahead')
        raw.removeAllListeners('data')
        const upgraded = new tls.TLSSocket(raw, { isServer: true, secureContext: ctx })
        sock = upgraded
        isTls = true
        buffer = ''
        upgraded.on('data', d => feed(d.toString('utf8')))
        upgraded.on('error', () => {})
        return
      }
      if (cmd.startsWith('AUTH PLAIN')) {
        const [, user, pass] = dec(line.slice(11).trim()).split('\0')
        authed = checkAuth(user, pass)
        return send(authed ? '235 ok' : '535 5.7.8 bad credentials')
      }
      if (cmd === 'AUTH LOGIN') { authStep = 'user'; return send('334 VXNlcm5hbWU6') }
      if (opts.auth && !authed && (cmd.startsWith('MAIL') || cmd.startsWith('RCPT'))) return send('530 5.7.0 authentication required')
      if (cmd.startsWith('MAIL FROM:')) { from = line.slice(10).replace(/[<>]/g, '').trim(); to = []; return send('250 ok') }
      if (cmd.startsWith('RCPT TO:')) {
        const rcpt = line.slice(8).replace(/[<>]/g, '').trim()
        if (opts.rejectRcpt?.includes(rcpt)) return send('550 5.1.1 no such user')
        to.push(rcpt)
        return send('250 ok')
      }
      if (cmd === 'DATA') { inData = true; data = ''; return send('354 end with <CRLF>.<CRLF>') }
      if (cmd === 'QUIT') { send('221 bye'); return sock.end() }
      return send('502 not implemented')
    }

    const feed = (chunk: string) => {
      buffer += chunk
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n')
          if (end < 0) return
          data = buffer.slice(0, end + 2)
          buffer = buffer.slice(end + 5)
          inData = false
          // undo dot-stuffing like a real server
          mails.push({ from, to, data: data.replace(/(^|\r\n)\.\./g, '$1.'), authed, tls: isTls })
          send('250 queued')
          continue
        }
        const idx = buffer.indexOf('\r\n')
        if (idx < 0) return
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        onLine(line)
      }
    }

    raw.on('data', d => feed(d.toString('utf8')))
    raw.on('error', () => {})
    send('220 fake.local ESMTP ready')
  }

  const server = opts.mode === 'tls'
    ? tls.createServer({ key: TEST_KEY, cert: TEST_CERT }, s => handle(s, true))
    : net.createServer(s => handle(s, false))

  await new Promise<void>(res => server.listen(0, '127.0.0.1', res))
  const port = (server.address() as net.AddressInfo).port

  return {
    port,
    mails,
    commands,
    close: () => new Promise<void>(res => { server.close(() => res()); (server as any).closeAllConnections?.() }),
  }
}
