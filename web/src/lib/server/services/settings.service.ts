import { settings } from '@wordsvelte/shared'
import { ValidationError } from '$lib/server/errors'

/** Never returned by any API or page, and never writable through the settings API. */
const SECRET_KEYS = new Set(['jwt_secret'])
const SECRET_KEY_PATTERN = /(^|_)(secret|token|password|api_key|private_key)(_|$)/
/** Visible only to authenticated admins. */
const PRIVATE_KEYS = new Set(['admin_email'])

const KEY_RE = /^[a-z0-9_]{1,64}$/
const MAX_VALUE_LENGTH = 10_000
const MAX_KEYS_PER_UPDATE = 100

export const isSecretKey = (key: string) => SECRET_KEYS.has(key) || SECRET_KEY_PATTERN.test(key)
export const isPrivateKey = (key: string) => PRIVATE_KEYS.has(key)

/**
 * `scope: 'public'` is what the site (and any anonymous caller) may see;
 * `scope: 'admin'` additionally includes private keys. Secrets are never included.
 */
export async function getSettings(db: any, opts: { scope?: 'public' | 'admin' } = {}): Promise<Record<string, string>> {
	const scope = opts.scope ?? 'public'
	const all = await db.select().from(settings)
	const data: Record<string, string> = {}
	for (const s of all) {
		if (isSecretKey(s.key)) continue
		if (scope === 'public' && isPrivateKey(s.key)) continue
		data[s.key] = s.value
	}
	return data
}

export async function updateSettings(db: any, data: Record<string, unknown>) {
	const entries = Object.entries(data)
	if (entries.length > MAX_KEYS_PER_UPDATE) throw new ValidationError('Too many settings in one request')
	for (const [key, value] of entries) {
		if (!KEY_RE.test(key)) throw new ValidationError(`Invalid setting key: ${key.slice(0, 40)}`)
		if (isSecretKey(key)) throw new ValidationError(`Setting "${key}" cannot be changed here`)
		if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
			throw new ValidationError(`Setting "${key}" must be a string, number or boolean`)
		}
		if (String(value).length > MAX_VALUE_LENGTH) throw new ValidationError(`Setting "${key}" is too long`)
	}
	for (const [key, value] of entries) {
		const v = String(value)
		await db.insert(settings).values({ key, value: v }).onConflictDoUpdate({ target: settings.key, set: { value: v } })
	}
}
