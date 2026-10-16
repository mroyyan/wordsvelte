import { getSigningSecret } from '$lib/server/auth'
import { getMailer, SmtpMailer, type Mailer } from '$lib/server/mail/mailer'
import { loadSmtpConfig } from '$lib/server/services/account/smtp-config.service'

/** SMTP from Settings > Email wins; otherwise the environment (Resend), then the dev console / loud production no-op. */
export async function resolveMailer(db: any, event: any): Promise<Mailer> {
  try {
    const cfg = await loadSmtpConfig(db, await getSigningSecret(event))
    if (cfg) return new SmtpMailer(cfg)
  } catch (e) {
    console.error('Could not load SMTP settings, falling back to the default mailer:', e)
  }
  return getMailer(event.platform?.env)
}
