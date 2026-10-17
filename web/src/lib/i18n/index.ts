import { page } from '$app/state'
import { createTranslator, DEFAULT_LOCALE, type Params } from './translator'
import type { MessageKey } from './en'

export { createTranslator, DEFAULT_LOCALE, catalogs } from './translator'
export type { MessageKey, Message } from './en'
export type { Params, Translate } from './translator'

/** The language chosen in Settings, read from the page data of the current request (no state shared between requests). */
export const currentLocale = (): string => page.data?.settings?.language || DEFAULT_LOCALE

/** Translate a message into the site's language. Call it in templates and `$derived`: it follows the page data. */
export function t(key: MessageKey, params?: Params): string {
  return createTranslator(currentLocale())(key, params)
}
