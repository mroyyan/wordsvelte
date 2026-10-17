/**
 * Date formatting driven by the site settings (language, timezone and a PHP-style format string such as "d F Y").
 * Pure and dependency-free so it behaves the same during SSR (Workers) and in the browser.
 */

export const LANGUAGES = [
  { value: 'id', label: 'Bahasa Indonesia', locale: 'id-ID' },
  { value: 'en', label: 'English', locale: 'en-US' },
] as const

export const DATE_FORMATS = ['d F Y', 'j F Y', 'd M Y', 'l, d F Y', 'd/m/Y', 'Y-m-d', 'F j, Y', 'd F Y H:i'] as const

/** Characters a date format may contain: tokens, spaces and plain separators. */
export const DATE_FORMAT_RE = /^[djmnMFYyDlHi\s,.\-/:]{1,30}$/

export const DEFAULT_TIMEZONE = 'Asia/Jakarta'

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz) return false
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true } catch { return false }
}

export function localeFor(language: string | undefined): string {
  return LANGUAGES.find(l => l.value === language)?.locale ?? 'id-ID'
}

/** Stored timestamps are UTC, either ISO ("2026-10-05T09:00:00.000Z" / no offset) or SQLite ("2026-10-05 09:00:00"). */
export function parseStoredDate(value: string | null | undefined): Date | null {
  if (!value || typeof value !== 'string' || value.includes('datetime')) return null
  let v = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) v += 'T00:00:00Z'
  else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(v)) v = v.replace(' ', 'T') + 'Z'
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)) v += 'Z'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

export interface DateSettings {
  date_format?: string
  language?: string
  timezone?: string
}

export function formatDateWith(value: string | null | undefined, settings: DateSettings = {}): string {
  const date = parseStoredDate(value)
  if (!date) return 'Baru saja'

  const locale = localeFor(settings.language)
  const timeZone = isValidTimeZone(settings.timezone) ? settings.timezone : isValidTimeZone(DEFAULT_TIMEZONE) ? DEFAULT_TIMEZONE : 'UTC'
  const format = settings.date_format && DATE_FORMAT_RE.test(settings.date_format) ? settings.date_format : 'd F Y'

  const numeric = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
  const parts: Record<string, string> = {}
  for (const p of numeric.formatToParts(date)) parts[p.type] = p.value
  const name = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone, ...opts }).format(date)

  const pad = (s: string) => s.padStart(2, '0')
  const tokens: Record<string, () => string> = {
    d: () => pad(parts.day),
    j: () => String(Number(parts.day)),
    m: () => pad(parts.month),
    n: () => String(Number(parts.month)),
    M: () => name({ month: 'short' }),
    F: () => name({ month: 'long' }),
    Y: () => parts.year,
    y: () => parts.year.slice(-2),
    D: () => name({ weekday: 'short' }),
    l: () => name({ weekday: 'long' }),
    H: () => pad(parts.hour),
    i: () => pad(parts.minute),
  }
  return [...format].map(ch => (tokens[ch] ? tokens[ch]() : ch)).join('')
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Wall-clock parts of an instant in a timezone. */
function zonedParts(date: Date, timeZone: string) {
  const parts: Record<string, number> = {}
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
  for (const p of fmt.formatToParts(date)) if (p.type !== 'literal') parts[p.type] = Number(p.value)
  return parts
}

/** An instant as "YYYY-MM-DDTHH:mm" on the wall clock of `timeZone` (the value format of <input type="datetime-local">). */
export function utcToZonedLocal(value: string | null | undefined, timeZone: string): string {
  const date = parseStoredDate(value)
  if (!date) return ''
  const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE
  const p = zonedParts(date, tz)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`
}

/**
 * The instant (ISO, UTC) at which the wall clock of `timeZone` reads `local` ("YYYY-MM-DDTHH:mm"), or null if it is
 * not a valid date. The offset is found by asking what the zone's clock shows for a first guess and correcting once
 * (twice around a daylight-saving change), which needs no timezone database of our own.
 */
export function zonedLocalToUtc(local: string | null | undefined, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(local ?? '').trim())
  if (!m) return null
  const [y, mo, d, h, mi] = m.slice(1).map(Number)
  const wanted = Date.UTC(y, mo - 1, d, h, mi)
  if (new Date(wanted).getUTCMonth() !== mo - 1 || new Date(wanted).getUTCDate() !== d) return null // e.g. 31 February
  const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIMEZONE

  let guess = wanted
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), tz)
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
    if (shown === wanted) break
    guess += wanted - shown
  }
  return new Date(guess).toISOString()
}
