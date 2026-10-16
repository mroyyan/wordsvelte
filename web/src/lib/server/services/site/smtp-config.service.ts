import type { DbInstance } from '$lib/server/db'
import { ValidationError } from '$lib/server/core/errors'
import { EMAIL_RE } from '$lib/server/core/validators'
import { openSecret, sealSecret } from '$lib/server/auth/two-factor/secret-box'
import { createSettingsRepository } from '$lib/server/repositories/settings.repository'
import { isLoopbackHost, type SmtpConfig, type SmtpEncryption } from '$lib/server/mail/smtp'

const KEYS = ['smtp_host', 'smtp_port', 'smtp_encryption', 'smtp_username', 'smtp_password', 'smtp_from_email', 'smtp_from_name'] as const
const PASSWORD_PURPOSE = 'smtp-password'
const ENCRYPTIONS: SmtpEncryption[] = ['none', 'starttls', 'tls']
const HOST_RE = /^(?=.{1,253}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/

/** What the admin UI may see: everything except the password, which is only reported as set or not. */
export interface SmtpSettingsView {
  host: string
  port: number
  encryption: SmtpEncryption
  username: string
  fromEmail: string
  fromName: string
  passwordSet: boolean
  /** The stored password exists but cannot be decrypted (JWT_SECRET changed): it must be entered again. */
  passwordUnreadable: boolean
  configured: boolean
}

export interface SmtpSettingsInput {
  host?: unknown
  port?: unknown
  encryption?: unknown
  username?: unknown
  /** undefined keeps the stored password; a string replaces it. */
  password?: unknown
  clearPassword?: unknown
  fromEmail?: unknown
  fromName?: unknown
}

async function readRaw(db: DbInstance): Promise<Record<string, string>> {
  const rows = await createSettingsRepository(db).getMany([...KEYS])
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

function decodeRaw(raw: Record<string, string>) {
  const encryption = ENCRYPTIONS.includes(raw.smtp_encryption as SmtpEncryption) ? (raw.smtp_encryption as SmtpEncryption) : 'starttls'
  const port = Number(raw.smtp_port)
  return {
    host: raw.smtp_host ?? '',
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : encryption === 'tls' ? 465 : 587,
    encryption,
    username: raw.smtp_username ?? '',
    fromEmail: raw.smtp_from_email ?? '',
    fromName: raw.smtp_from_name ?? '',
  }
}

export async function getSmtpSettings(db: DbInstance, secret: Uint8Array): Promise<SmtpSettingsView> {
  const raw = await readRaw(db)
  const base = decodeRaw(raw)
  const stored = raw.smtp_password ?? ''
  const readable = stored ? (await openSecret(secret, PASSWORD_PURPOSE, stored)) !== null : true
  return {
    ...base,
    passwordSet: stored !== '',
    passwordUnreadable: stored !== '' && !readable,
    configured: Boolean(base.host && base.fromEmail),
  }
}

/** The settings in the shape the SMTP client wants, or null when mail is not configured (or the password is unreadable). */
export async function loadSmtpConfig(db: DbInstance, secret: Uint8Array): Promise<SmtpConfig | null> {
  const raw = await readRaw(db)
  const base = decodeRaw(raw)
  if (!base.host || !base.fromEmail) return null
  let password: string | undefined
  if (raw.smtp_password) {
    const opened = await openSecret(secret, PASSWORD_PURPOSE, raw.smtp_password)
    if (opened === null) return null
    password = opened
  }
  return { ...base, username: base.username || undefined, password, fromName: base.fromName || undefined }
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function saveSmtpSettings(db: DbInstance, secret: Uint8Array, input: SmtpSettingsInput): Promise<SmtpSettingsView> {
  const host = text(input.host)
  const fromEmail = text(input.fromEmail)
  const fromName = text(input.fromName).replace(/[\r\n]+/g, ' ')
  const username = text(input.username)
  const encryption = text(input.encryption) as SmtpEncryption
  const port = typeof input.port === 'number' ? input.port : Number(text(input.port))

  // Clearing the host switches SMTP off entirely.
  if (!host) {
    await createSettingsRepository(db).deleteMany([...KEYS])
    return getSmtpSettings(db, secret)
  }

  if (!HOST_RE.test(host)) throw new ValidationError('SMTP host must be a hostname such as smtp.example.com')
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ValidationError('SMTP port must be a number between 1 and 65535')
  if (!ENCRYPTIONS.includes(encryption)) throw new ValidationError('Encryption must be none, starttls or tls')
  if (!fromEmail || fromEmail.length > 254 || !EMAIL_RE.test(fromEmail)) throw new ValidationError('From email must be a valid email address')
  if (fromName.length > 100) throw new ValidationError('From name must be at most 100 characters')
  if (username.length > 255 || /[\r\n\0]/.test(username)) throw new ValidationError('SMTP username is invalid')

  const newPassword = typeof input.password === 'string' && input.password !== '' ? input.password : null
  if (newPassword && (newPassword.length > 500 || /[\r\n\0]/.test(newPassword))) throw new ValidationError('SMTP password is invalid')

  const before = await readRaw(db)
  const willHavePassword = input.clearPassword === true ? false : Boolean(newPassword || before.smtp_password)
  if (username && encryption === 'none' && !isLoopbackHost(host)) {
    throw new ValidationError('Choose STARTTLS or SSL/TLS: a login over an unencrypted connection would expose the password.')
  }
  if (username && !willHavePassword) throw new ValidationError('Enter the SMTP password for this username')

  const store = createSettingsRepository(db)
  await store.upsert('smtp_host', host)
  await store.upsert('smtp_port', String(port))
  await store.upsert('smtp_encryption', encryption)
  await store.upsert('smtp_username', username)
  await store.upsert('smtp_from_email', fromEmail)
  await store.upsert('smtp_from_name', fromName)

  if (input.clearPassword === true || !username) {
    await store.deleteMany(['smtp_password'])
  } else if (newPassword) {
    await store.upsert('smtp_password', await sealSecret(secret, PASSWORD_PURPOSE, newPassword))
  }
  return getSmtpSettings(db, secret)
}
