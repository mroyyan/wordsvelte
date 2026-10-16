import { getDb } from '$lib/server/db'
import { getSigningSecret, requireUser } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/response'
import { AppError, ValidationError } from '$lib/server/errors'
import { loadSmtpConfig } from '$lib/server/services/smtp-config.service'
import { MailFormatError, SmtpError, sendSmtpMail } from '$lib/server/smtp'

/** Sends a test message through the saved SMTP settings and reports exactly where it fails. Defaults to the admin's own address. */
export async function POST(event: any) {
  try {
    const me = await requireUser(event, 'admin')
    const body = await readJson(event.request)
    const to = typeof body.to === 'string' && body.to.trim() ? body.to.trim() : me.email
    const cfg = await loadSmtpConfig(getDb(event), await getSigningSecret(event))
    if (!cfg) throw new ValidationError('Save the SMTP settings first (host and from address are required, and the stored password must be readable).')
    try {
      await sendSmtpMail(cfg, { to, subject: 'SMTP test', text: 'This is a test message. Your SMTP settings work.' })
    } catch (e) {
      if (e instanceof SmtpError || e instanceof MailFormatError) throw new AppError(e.message, 502)
      throw e
    }
    return ok({ sent: true, to })
  } catch (e) { return catchError(e) }
}
