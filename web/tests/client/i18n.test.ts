import { describe, it, expect } from 'vitest'
import { en } from '../../src/lib/i18n/en'
import { id } from '../../src/lib/i18n/id'
import { catalogs, createTranslator, DEFAULT_LOCALE } from '../../src/lib/i18n/translator'
import { LANGUAGES, formatDateWith } from '../../src/lib/shared/format-date'

const texts = (m: string | { one: string; other: string }) => (typeof m === 'string' ? [m] : [m.one, m.other])
const placeholders = (m: string | { one: string; other: string }) => [...new Set(texts(m).flatMap(t => [...t.matchAll(/\{(\w+)\}/g)].map(x => x[1])))].sort()

describe('message catalogs', () => {
  it('every language has exactly the keys English has', () => {
    const keys = Object.keys(en).sort()
    for (const [code, catalog] of Object.entries(catalogs)) expect(Object.keys(catalog).sort(), code).toEqual(keys)
  })

  it('a translation uses the same placeholders as the English message (no lost or misspelt {name})', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(id[key]), key).toEqual(placeholders(en[key]))
    }
  })

  it('no message is empty', () => {
    for (const catalog of Object.values(catalogs)) for (const m of Object.values(catalog)) for (const t of texts(m)) expect(t.trim()).not.toBe('')
  })

  it('every language offered in Settings has a catalog, and the other way round', () => {
    expect(LANGUAGES.map(l => l.value).sort()).toEqual(Object.keys(catalogs).sort())
    expect(catalogs[DEFAULT_LOCALE]).toBeDefined()
  })
})

describe('createTranslator', () => {
  it('translates into the chosen language', () => {
    expect(createTranslator('en')('common.home')).toBe('Home')
    expect(createTranslator('id')('common.home')).toBe('Beranda')
  })

  it('falls back to the default language for an unknown or missing one', () => {
    for (const locale of [undefined, null, '', 'xx', 'EN']) expect(createTranslator(locale as any)('common.home'), String(locale)).toBe('Beranda')
  })

  it('fills {placeholders} and leaves unknown ones visible instead of failing', () => {
    expect(createTranslator('en')('search.resultsFor', { q: 'rain', n: 3 })).toBe('Results for "rain" (3 found)')
    expect(createTranslator('id')('search.viewAll', { n: 12, q: 'hujan' })).toBe('Lihat semua 12 hasil untuk “hujan”')
    expect(createTranslator('en')('search.noResults')).toBe('No results for “{q}”.')
  })

  it('does not treat the inserted text as a template (no double substitution)', () => {
    expect(createTranslator('en')('search.noResults', { q: '{n}' })).toBe('No results for “{n}”.')
  })

  it('picks singular or plural by n', () => {
    const en1 = createTranslator('en')
    expect(en1('archive.count', { n: 1 })).toBe('1 article')
    expect(en1('archive.count', { n: 0 })).toBe('0 articles')
    expect(en1('archive.count', { n: 2 })).toBe('2 articles')
    expect(createTranslator('id')('post.comments', { n: 5 })).toBe('5 Komentar')
  })

  it('returns the key itself for a message nobody wrote', () => {
    expect(createTranslator('en')('no.such.key' as any)).toBe('no.such.key')
  })
})

describe('the date formatter uses the same language', () => {
  it('says "just now" in the site language when the date is unusable', () => {
    expect(formatDateWith('nonsense', { language: 'en' })).toBe('Just now')
    expect(formatDateWith('nonsense', { language: 'id' })).toBe('Baru saja')
    expect(formatDateWith('nonsense')).toBe('Baru saja')
  })
})
