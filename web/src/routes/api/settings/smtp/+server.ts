import { getDb } from '$lib/server/db'
import { getSigningSecret, requireUser } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/http/response'
import { getSmtpSettings, saveSmtpSettings } from '$lib/server/services/site/smtp-config.service'

/** Mail server settings (admin only). The password is never returned, only whether one is stored. */
export async function GET(event: any) {
  try {
    await requireUser(event, 'admin')
    return ok(await getSmtpSettings(getDb(event), await getSigningSecret(event)))
  } catch (e) { return catchError(e) }
}

export async function PUT(event: any) {
  try {
    await requireUser(event, 'admin')
    return ok(await saveSmtpSettings(getDb(event), await getSigningSecret(event), await readJson(event.request)))
  } catch (e) { return catchError(e) }
}
