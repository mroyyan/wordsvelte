import { sendViaSmtp, type Connector, type SmtpConfig } from './client'
import type { MailMessageInput } from './message'

export { SmtpError, isLoopbackHost, type SmtpConfig, type SmtpEncryption } from './client'
export { MailFormatError } from './message'

async function pickConnector(): Promise<Connector> {
  // Local development (Node) uses node:net. `import.meta.env.DEV` is statically false in production builds, so the
  // Node transport is dropped from the Worker bundle, which instead uses Cloudflare's TCP sockets.
  if (import.meta.env.DEV) return (await import('./node-transport')).nodeConnector()
  return (await import('./workers-transport')).workersConnector
}

export async function sendSmtpMail(cfg: SmtpConfig, msg: MailMessageInput, connector?: Connector): Promise<void> {
  return sendViaSmtp(cfg, msg, connector ?? (await pickConnector()))
}
