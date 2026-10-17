import { page } from '$app/state'
import { formatDateWith } from '$lib/shared/format-date'
import { adminCatalogs } from './admin/catalogs'
import { DEFAULT_LOCALE, fill, type Params } from './translator'

/**
 * Translation for the admin panel. The text you pass is the English wording itself:
 *
 *   tr('Add Post')                       // plain
 *   tr('{n} files selected', { n })      // with a value
 *   msg('Dashboard')                     // marks a text in a config file; translate it where it is shown: tr(item.title)
 *
 * Only plain string literals are allowed as the first argument of `tr` and `msg`: `tests/client/admin-i18n.test.ts` finds them in the source and
 * checks that each one has a translation in every catalog under `i18n/admin/`.
 */
export const msg = <T extends string>(text: T): T => text

/** The admin language: the person's own choice (Profile > Appearance), otherwise the site language. */
export function adminLocale(): string {
  try {
    return page.data?.user?.language || page.data?.settings?.language || DEFAULT_LOCALE
  } catch {
    // No page to read (outside rendering and event handlers, e.g. a unit test or a server-side load): plain English, the source language
    return 'en'
  }
}

export function tr(text: string, params?: Params): string {
  const translated = adminCatalogs[adminLocale()]?.[text] ?? text
  return fill(translated, params)
}

/** A stored timestamp in the admin language, site timezone and the site's date format. */
export function formatAdminDate(value: string | null | undefined): string {
  return formatDateWith(value, { ...page.data?.settings, language: adminLocale() })
}

/** The display name of a role code (admin, editor, author). */
export const roleName = (role: string | null | undefined): string =>
  role === 'admin' ? tr('Admin') : role === 'editor' ? tr('Editor') : role === 'author' ? tr('Author') : (role ?? '')
