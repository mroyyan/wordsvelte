/** Building RFC 5322 / MIME messages. Pure functions: everything user-supplied is validated or encoded here, once. */

export interface MailAddress { email: string; name?: string }

export interface MailMessageInput {
  to: string
  subject: string
  text: string
  html?: string
}

export class MailFormatError extends Error {}

// Pragmatic address check (the same strictness as the rest of the app) plus a hard ban on anything that could
// start a new header or SMTP command: CR, LF, NUL, angle brackets, quotes, spaces, commas.
const ADDRESS_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/

export function assertAddress(email: string): string {
  const e = String(email ?? '').trim()
  if (!e || e.length > 254 || /[\r\n\0<>,"\s]/.test(e) || !ADDRESS_RE.test(e)) throw new MailFormatError('Invalid email address')
  return e
}

const toBase64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Wrap at 76 columns as MIME requires. */
const wrap76 = (b64: string) => (b64.match(/.{1,76}/g) ?? []).join('\r\n')

/** RFC 2047 encoded-words, split on character boundaries so a multi-byte character is never cut in half. */
export function encodeHeaderText(text: string): string {
  const clean = String(text ?? '').replace(/[\r\n\0]+/g, ' ').trim()
  if (/^[\x20-\x7e]*$/.test(clean)) return clean
  const enc = new TextEncoder()
  const words: string[] = []
  let chunk = ''
  for (const ch of clean) {
    if (enc.encode(chunk + ch).length > 42) { words.push(chunk); chunk = '' }
    chunk += ch
  }
  if (chunk) words.push(chunk)
  return words.map(w => `=?UTF-8?B?${toBase64(enc.encode(w))}?=`).join('\r\n ')
}

export function formatAddress(a: MailAddress): string {
  const email = assertAddress(a.email)
  const name = String(a.name ?? '').replace(/[\r\n\0]+/g, ' ').trim()
  if (!name) return email
  if (/^[\x20-\x7e]*$/.test(name)) return /^[A-Za-z0-9 ._-]+$/.test(name) ? `${name} <${email}>` : `"${name.replace(/(["\\])/g, '\\$1')}" <${email}>`
  return `${encodeHeaderText(name)} <${email}>`
}

/** RFC 5322 date: "Fri, 16 Oct 2026 14:00:00 +0000". */
export const rfc5322Date = (d: Date) => d.toUTCString().replace('GMT', '+0000')

const normalizeNewlines = (s: string) => String(s ?? '').replace(/\r\n|\r|\n/g, '\r\n')

export function buildMessage(o: { from: MailAddress; to: string; subject: string; text: string; html?: string; date?: Date; messageIdDomain?: string }): string {
  const from = formatAddress(o.from)
  const to = formatAddress({ email: o.to })
  const domain = o.messageIdDomain ?? o.from.email.split('@')[1] ?? 'localhost'
  const headers = [
    `Date: ${rfc5322Date(o.date ?? new Date())}`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderText(o.subject)}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
  ]
  const enc = new TextEncoder()
  const part = (type: string, body: string) =>
    `Content-Type: ${type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(toBase64(enc.encode(normalizeNewlines(body))))}`

  if (!o.html) return `${headers.join('\r\n')}\r\n${part('text/plain', o.text)}\r\n`

  const boundary = `=_${crypto.randomUUID().replace(/-/g, '')}`
  return `${headers.join('\r\n')}\r\nContent-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n` +
    `--${boundary}\r\n${part('text/plain', o.text)}\r\n--${boundary}\r\n${part('text/html', o.html)}\r\n--${boundary}--\r\n`
}

/** SMTP transparency (RFC 5321 4.5.2): a line that starts with "." gets another "." so it cannot end the DATA phase early. */
export const dotStuff = (data: string) => data.replace(/(^|\r\n)\./g, '$1..')
