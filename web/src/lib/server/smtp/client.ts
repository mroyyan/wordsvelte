import { assertAddress, buildMessage, dotStuff, type MailMessageInput } from './message'

/**
 * A small SMTP client (RFC 5321) written against an abstract Transport, because Cloudflare Workers have no Node `net`:
 * production uses cloudflare:sockets, local development and the tests use node:net / node:tls.
 */

export type SmtpEncryption = 'none' | 'starttls' | 'tls'

export interface SmtpConfig {
  host: string
  port: number
  encryption: SmtpEncryption
  username?: string
  password?: string
  fromEmail: string
  fromName?: string
  timeoutMs?: number
  /** Name announced in EHLO. */
  clientName?: string
}

export interface Transport {
  /** Next CRLF-terminated line without the terminator, or null when the server closed the connection. */
  readLine(): Promise<string | null>
  write(data: string): Promise<void>
  /** Upgrade the open connection to TLS (after the server accepted STARTTLS). */
  startTls(): Promise<void>
  close(): Promise<void>
}

export type Connector = (target: { host: string; port: number; encryption: SmtpEncryption; timeoutMs: number }) => Promise<Transport>

/** Safe to show to an administrator (never contains the password). `step` says where in the conversation it failed. */
export class SmtpError extends Error {
  constructor(message: string, public step?: string, public code?: number) { super(message) }
}

const DEFAULT_TIMEOUT = 15_000
const clip = (s: string) => s.replace(/[\r\n]+/g, ' ').slice(0, 200)
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))

export const isLoopbackHost = (host: string) => /^(localhost|127(?:\.\d{1,3}){3}|\[?::1\]?)$/i.test(host)

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    p,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new SmtpError(`Timed out waiting for the server (${what})`, what)), ms) }),
  ]).finally(() => clearTimeout(timer!))
}

interface Reply { code: number; lines: string[] }

async function readReply(t: Transport, ms: number, step: string): Promise<Reply> {
  const lines: string[] = []
  for (;;) {
    const line = await withTimeout(t.readLine(), ms, step)
    if (line === null) throw new SmtpError('The server closed the connection unexpectedly', step)
    const m = /^(\d{3})([ -])(.*)$/.exec(line)
    if (!m) throw new SmtpError(`Unexpected response from the server: ${clip(line)}`, step)
    lines.push(m[3])
    if (m[2] === ' ') return { code: Number(m[1]), lines }
  }
}

async function command(t: Transport, ms: number, step: string, line: string, expect: number[]): Promise<Reply> {
  await t.write(line + '\r\n')
  const reply = await readReply(t, ms, step)
  if (!expect.includes(reply.code)) throw new SmtpError(`${step} was refused: ${reply.code} ${clip(reply.lines.join(' '))}`, step, reply.code)
  return reply
}

export async function sendViaSmtp(cfg: SmtpConfig, msg: MailMessageInput, connect: Connector): Promise<void> {
  const ms = cfg.timeoutMs ?? DEFAULT_TIMEOUT
  const from = assertAddress(cfg.fromEmail)
  const to = assertAddress(msg.to)

  if (cfg.username && cfg.encryption === 'none' && !isLoopbackHost(cfg.host)) {
    throw new SmtpError('Refusing to send the SMTP password without encryption. Choose STARTTLS or SSL/TLS.', 'connect')
  }

  const mime = buildMessage({ from: { email: from, name: cfg.fromName }, to, subject: msg.subject, text: msg.text, html: msg.html })

  let t: Transport
  try {
    t = await withTimeout(connect({ host: cfg.host, port: cfg.port, encryption: cfg.encryption, timeoutMs: ms }), ms, 'connect')
  } catch (e) {
    if (e instanceof SmtpError) throw e
    throw new SmtpError(`Could not connect to ${cfg.host}:${cfg.port} (${clip(e instanceof Error ? e.message : String(e))})`, 'connect')
  }

  try {
    const greeting = await readReply(t, ms, 'greeting')
    if (greeting.code !== 220) throw new SmtpError(`The server did not accept the connection: ${greeting.code} ${clip(greeting.lines.join(' '))}`, 'greeting', greeting.code)

    const ehlo = async () => (await command(t, ms, 'EHLO', `EHLO ${cfg.clientName ?? 'wordsvelte.local'}`, [250])).lines.map(l => l.toUpperCase())
    let caps = await ehlo()

    if (cfg.encryption === 'starttls') {
      if (!caps.some(c => c === 'STARTTLS')) throw new SmtpError('The server does not offer STARTTLS. Try SSL/TLS (usually port 465) or check the port.', 'STARTTLS')
      await command(t, ms, 'STARTTLS', 'STARTTLS', [220])
      await withTimeout(t.startTls(), ms, 'STARTTLS')
      caps = await ehlo() // capabilities must be re-read over the encrypted channel
    }

    if (cfg.username) {
      const auth = caps.find(c => c.startsWith('AUTH')) ?? ''
      const password = cfg.password ?? ''
      try {
        if (/\bPLAIN\b/.test(auth)) {
          await command(t, ms, 'AUTH', `AUTH PLAIN ${b64(`\0${cfg.username}\0${password}`)}`, [235])
        } else if (/\bLOGIN\b/.test(auth) || !auth) {
          await command(t, ms, 'AUTH', 'AUTH LOGIN', [334])
          await command(t, ms, 'AUTH', b64(cfg.username), [334])
          await command(t, ms, 'AUTH', b64(password), [235])
        } else {
          throw new SmtpError(`The server only supports unsupported login methods (${clip(auth)})`, 'AUTH')
        }
      } catch (e) {
        if (e instanceof SmtpError && e.code && [535, 534, 530, 454].includes(e.code)) {
          throw new SmtpError('Login failed: the server rejected the username or password.', 'AUTH', e.code)
        }
        throw e
      }
    }

    await command(t, ms, 'MAIL FROM', `MAIL FROM:<${from}>`, [250])
    await command(t, ms, 'RCPT TO', `RCPT TO:<${to}>`, [250, 251])
    await command(t, ms, 'DATA', 'DATA', [354])
    await t.write(dotStuff(mime) + '\r\n.\r\n')
    const done = await readReply(t, ms, 'sending the message')
    if (done.code !== 250) throw new SmtpError(`The server did not accept the message: ${done.code} ${clip(done.lines.join(' '))}`, 'DATA', done.code)

    await t.write('QUIT\r\n').catch(() => {})
  } finally {
    await t.close().catch(() => {})
  }
}
