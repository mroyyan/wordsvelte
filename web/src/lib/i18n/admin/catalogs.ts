import { id as shell } from './shell'
import { id as tables } from './tables'
import { id as content } from './content'
import { id as site } from './site'

/** The catalog files, one per area of the admin (kept apart so each can be edited on its own). */
export const adminCatalogParts: Record<string, string>[] = [shell, tables, content, site]

/**
 * Translations of the admin texts by language code. The key is the English text exactly as written in the source, so English needs no
 * catalog (an unknown text is shown as it is) and a missing translation degrades to readable English instead of a code.
 */
export const adminCatalogs: Record<string, Record<string, string>> = {
  id: Object.assign({}, ...adminCatalogParts),
}
