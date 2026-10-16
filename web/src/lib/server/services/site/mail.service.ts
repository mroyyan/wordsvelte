import type { DbInstance } from '$lib/server/db'
import { getSigningSecret } from '$lib/server/auth'
import { getMailer, SmtpMailer, type Mailer } from '$lib/server/mail/mailer'
import { loadSmtpConfig } from '$lib/server/services/site/smtp-config.service'
import { getSettings } from '$lib/server/services/site/settings.service'

/** SMTP from Settings > Email wins; otherwise the environment (Resend), then the dev console / loud production no-op. */
export async function resolveMailer(db: DbInstance, event: any): Promise<Mailer> {
  try {
    const cfg = await loadSmtpConfig(db, await getSigningSecret(event))
    if (cfg) return new SmtpMailer(cfg)
  } catch (e) {
    console.error('Could not load SMTP settings, falling back to the default mailer:', e)
  }
  return getMailer(event.platform?.env)
}

export interface MailContext { mailer: Mailer; siteName: string }

/** What a service needs to send a transactional email: where it goes out, and how the site is called in the subject. */
export async function getMailContext(db: DbInstance, event: any): Promise<MailContext> {
  const settings = await getSettings(db)
  return { mailer: await resolveMailer(db, event), siteName: settings.site_name || 'WordSvelte' }
}
