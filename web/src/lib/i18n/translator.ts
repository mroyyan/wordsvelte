import { en, type MessageKey, type Message } from './en'
import { id } from './id'

/**
 * Interface languages of the public site. To add one: create `<code>.ts` next to `id.ts` (it must define every key of `en.ts`, the type
 * checker enforces it), list it here and in `LANGUAGES` (`$lib/shared/format-date`), and it shows up in Settings > General > Language.
 */
export const catalogs: Record<string, Record<MessageKey, Message>> = { en, id }

/** Used when Settings has no language yet (the site started out in Indonesian). */
export const DEFAULT_LOCALE = 'id'

export type Params = Record<string, string | number>
export type Translate = (key: MessageKey, params?: Params) => string

export function fill(template: string, params?: Params): string {
  return params ? template.replace(/\{(\w+)\}/g, (whole, name) => (name in params ? String(params[name]) : whole)) : template
}

/**
 * A translate function for one language. An unknown language falls back to the default one, and a missing message to English, so a page is
 * never blank. A message may be one string or `{ one, other }`, chosen by `params.n` (1 is singular).
 */
export function createTranslator(locale?: string | null): Translate {
  const catalog = catalogs[locale ?? ''] ?? catalogs[DEFAULT_LOCALE]
  return (key, params) => {
    const message = catalog[key] ?? en[key] ?? key
    const template = typeof message === 'string' ? message : Number(params?.n) === 1 ? message.one : message.other
    return fill(template, params)
  }
}
