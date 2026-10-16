import { sendSmtpMail, type SmtpConfig } from '$lib/server/mail/smtp'

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface Mailer {
  send(message: MailMessage): Promise<void>
}

type MailEnv = { RESEND_API_KEY?: string; MAIL_FROM?: string } | undefined

/** Sends through Resend's HTTP API (works inside Workers). Configure RESEND_API_KEY and MAIL_FROM. */
export class ResendMailer implements Mailer {
  constructor(private apiKey: string, private from: string, private fetchImpl: typeof fetch = fetch) {}

  async send({ to, subject, text }: MailMessage) {
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [to], subject, text }),
    })
    if (!res.ok) throw new Error(`Mail provider responded ${res.status}`)
  }
}

/** Development fallback: print the message so the reset link can be copied from the terminal. */
export class ConsoleMailer implements Mailer {
  async send({ to, subject, text }: MailMessage) {
    console.log(`\n[mail] to=${to} subject="${subject}"\n${text}\n`)
  }
}

/** Used when nothing is configured in production: the link cannot be delivered, so say so loudly instead of failing silently. */
export class UnconfiguredMailer implements Mailer {
  async send({ to }: MailMessage) {
    console.error(`[mail] No mail provider configured (set RESEND_API_KEY and MAIL_FROM); password reset email for ${to} was NOT sent`)
  }
}

/** Sends through the SMTP server configured in Settings > Email. */
export class SmtpMailer implements Mailer {
  constructor(private cfg: SmtpConfig) {}

  async send({ to, subject, text, html }: MailMessage) {
    await sendSmtpMail(this.cfg, { to, subject, text, html })
  }
}

export function getMailer(env: MailEnv): Mailer {
  if (env?.RESEND_API_KEY && env.MAIL_FROM) return new ResendMailer(env.RESEND_API_KEY, env.MAIL_FROM)
  return import.meta.env.DEV ? new ConsoleMailer() : new UnconfiguredMailer()
}
