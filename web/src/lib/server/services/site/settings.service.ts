import { settings } from '@wordsvelte/shared'
import { ValidationError } from '$lib/server/core/errors'
import { DATE_FORMAT_RE, LANGUAGES, isValidTimeZone } from '$lib/shared/format-date'
import { EMAIL_RE } from '$lib/server/core/validators'

/** Never returned by any API or page, and never writable through the settings API. */
const SECRET_KEYS = new Set(['jwt_secret'])
// "smtp_" covers the mail server settings: they have their own endpoint (smtp-config.service.ts) with its own
// validation, and the stored password is encrypted, so none of it goes through the generic settings API.
const SECRET_KEY_PATTERN = /(^smtp_|(^|_)(secret|token|password|api_key|private_key)(_|$))/
/** Visible only to authenticated admins. */
const PRIVATE_KEYS = new Set(['admin_email'])

const KEY_RE = /^[a-z0-9_]{1,64}$/
const MAX_VALUE_LENGTH = 10_000
const MAX_KEYS_PER_UPDATE = 100

type Rule = (value: string) => string | null

const bool: Rule = v => (v === 'true' || v === 'false' ? null : 'must be true or false')
const maxLen = (n: number): Rule => v => (v.length <= n ? null : `must be at most ${n} characters`)
const intBetween = (min: number, max: number): Rule => v => (/^\d{1,6}$/.test(v) && Number(v) >= min && Number(v) <= max ? null : `must be a whole number between ${min} and ${max}`)
const optionalUrl: Rule = v => {
  if (v === '') return null
  try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:' ? null : 'must start with http:// or https://' } catch { return 'must be a full URL such as https://example.com' }
}

/**
 * Per-key checks for the settings the site actually reads. A bad value here is not cosmetic: "posts_per_page" = ""
 * would turn into NaN and break the home page, an unknown timezone would throw while formatting dates.
 * Keys without a rule (e.g. "theme") are still subject to the generic checks in updateSettings.
 */
export const SETTING_RULES: Record<string, Rule> = {
  site_name: v => (v.trim() ? maxLen(100)(v) : 'is required'),
  // The canonical address of the site (used for canonical links, sitemaps, share cards and RSS). Empty = detect from the request.
  site_url: v => {
    if (v === '') return null
    try {
      const u = new URL(v)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'must start with http:// or https://'
      if ((u.pathname !== '/' && u.pathname !== '') || u.search || u.hash) return 'must be the bare address without a path, e.g. https://example.com'
      return null
    } catch { return 'must be a full URL such as https://example.com' }
  },
  site_description: maxLen(500),
  admin_email: v => (v === '' || (EMAIL_RE.test(v) && v.length <= 254) ? null : 'must be a valid email address'),
  timezone: v => (isValidTimeZone(v) ? null : 'must be a valid timezone such as Asia/Jakarta'),
  date_format: v => (DATE_FORMAT_RE.test(v) ? null : 'is not a supported date format'),
  language: v => (LANGUAGES.some(l => l.value === v) ? null : `must be one of: ${LANGUAGES.map(l => l.value).join(', ')}`),
  posts_per_page: intBetween(1, 100),
  comments_close_after_days: intBetween(0, 3650),
  search_engine_visible: bool,
  sticky_sidebar: bool,
  comments_enabled: bool,
  comments_auto_approve: bool,
  comments_require_name_email: bool,
  social_facebook: optionalUrl,
  social_twitter: optionalUrl,
  social_instagram: optionalUrl,
  social_youtube: optionalUrl,
  default_og_image: v => (v === '' || v.startsWith('/') ? null : optionalUrl(v)),
  footer_copyright_text: maxLen(200),
  footer_description: maxLen(1000),
  default_meta_description: maxLen(300),
}

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
		const problem = SETTING_RULES[key]?.(String(value))
		if (problem) throw new ValidationError(`Setting "${key}" ${problem}`)
	}
	for (const [key, value] of entries) {
		const v = String(value)
		await db.insert(settings).values({ key, value: v }).onConflictDoUpdate({ target: settings.key, set: { value: v } })
	}
}
