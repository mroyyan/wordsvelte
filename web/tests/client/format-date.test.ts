import { describe, it, expect } from 'vitest'
import { formatDateWith, parseStoredDate, isValidTimeZone, localeFor, DATE_FORMATS, DATE_FORMAT_RE } from '../../src/lib/shared/format-date'

const S = (over: object = {}) => ({ date_format: 'd F Y', language: 'id', timezone: 'Asia/Jakarta', ...over })

describe('parseStoredDate', () => {
  it('reads every timestamp shape found in the database as UTC', () => {
    expect(parseStoredDate('2026-10-05T09:00:00.000Z')!.toISOString()).toBe('2026-10-05T09:00:00.000Z')
    expect(parseStoredDate('2026-10-05T09:00:00')!.toISOString()).toBe('2026-10-05T09:00:00.000Z') // WordPress import
    expect(parseStoredDate('2026-10-05 09:00:00')!.toISOString()).toBe('2026-10-05T09:00:00.000Z') // SQLite default
    expect(parseStoredDate('2026-10-05')!.toISOString()).toBe('2026-10-05T00:00:00.000Z')
  })
  it.each([null, undefined, '', 'garbage', "datetime('now')", '2026-13-45T00:00:00Z'])('returns null for %j', v => {
    expect(parseStoredDate(v as any)).toBeNull()
  })
})

describe('formatDateWith', () => {
  const stored = '2026-10-05T09:30:00.000Z' // 16:30 in Jakarta

  it('formats with the default pattern in Indonesian', () => {
    expect(formatDateWith(stored, S())).toBe('05 Oktober 2026')
  })

  it('every offered preset renders something sensible', () => {
    const out = Object.fromEntries(DATE_FORMATS.map(f => [f, formatDateWith(stored, S({ date_format: f }))]))
    expect(out['d F Y']).toBe('05 Oktober 2026')
    expect(out['j F Y']).toBe('5 Oktober 2026')
    expect(out['d M Y']).toMatch(/^05 Okt/)
    expect(out['d/m/Y']).toBe('05/10/2026')
    expect(out['Y-m-d']).toBe('2026-10-05')
    expect(out['l, d F Y']).toBe('Senin, 05 Oktober 2026')
    expect(out['d F Y H:i']).toBe('05 Oktober 2026 16:30')
  })

  it('switches language', () => {
    expect(formatDateWith(stored, S({ language: 'en' }))).toBe('05 October 2026')
    expect(formatDateWith(stored, S({ language: 'en', date_format: 'l, F j, Y' }))).toBe('Monday, October 5, 2026')
  })

  it('applies the timezone, including crossing midnight into the next day', () => {
    const lateUtc = '2026-10-05T20:30:00.000Z'
    expect(formatDateWith(lateUtc, S({ timezone: 'UTC', date_format: 'Y-m-d H:i' }))).toBe('2026-10-05 20:30')
    expect(formatDateWith(lateUtc, S({ timezone: 'Asia/Jakarta', date_format: 'Y-m-d H:i' }))).toBe('2026-10-06 03:30')
    expect(formatDateWith(lateUtc, S({ timezone: 'Asia/Jayapura', date_format: 'Y-m-d H:i' }))).toBe('2026-10-06 05:30')
    expect(formatDateWith(lateUtc, S({ timezone: 'America/New_York', date_format: 'Y-m-d H:i' }))).toBe('2026-10-05 16:30')
  })

  it('falls back to safe defaults for missing or invalid settings instead of throwing', () => {
    expect(formatDateWith(stored)).toBe('05 Oktober 2026')
    expect(formatDateWith(stored, { timezone: 'Mars/Olympus' })).toBe('05 Oktober 2026')
    expect(formatDateWith(stored, { language: 'xx' })).toBe('05 Oktober 2026')
    expect(formatDateWith(stored, { date_format: '<script>' })).toBe('05 Oktober 2026')
  })

  it('shows a friendly placeholder for unparsable or not-yet-stored dates', () => {
    expect(formatDateWith('')).toBe('Baru saja')
    expect(formatDateWith("datetime('now')")).toBe('Baru saja')
    expect(formatDateWith('nonsense')).toBe('Baru saja')
    expect(formatDateWith(null)).toBe('Baru saja')
  })

  it('handles two-digit years and midnight', () => {
    expect(formatDateWith('2026-01-02T17:00:00Z', S({ date_format: 'd/m/y H:i' }))).toBe('03/01/26 00:00') // 00:00 not "24:00"
  })
})

describe('helpers', () => {
  it('isValidTimeZone', () => {
    for (const tz of ['Asia/Jakarta', 'UTC', 'Europe/London']) expect(isValidTimeZone(tz)).toBe(true)
    for (const tz of ['', 'Nope/Zone', null, undefined, 5, 'asia jakarta']) expect(isValidTimeZone(tz)).toBe(false)
  })
  it('localeFor maps known languages and defaults to Indonesian', () => {
    expect(localeFor('en')).toBe('en-US')
    expect(localeFor('id')).toBe('id-ID')
    expect(localeFor(undefined)).toBe('id-ID')
  })
  it('DATE_FORMAT_RE accepts the presets and rejects anything else', () => {
    for (const f of DATE_FORMATS) expect(DATE_FORMAT_RE.test(f)).toBe(true)
    for (const f of ['', '<b>', 'd F Y; DROP', 'x'.repeat(31), 'q']) expect(DATE_FORMAT_RE.test(f)).toBe(false)
  })
})
