import { page } from '$app/state'
import { formatDateWith } from '$lib/format-date'

/**
 * Format a stored timestamp for the PUBLIC site using the language, timezone and date format chosen in Settings.
 * It reads the settings from the current request's page data, so there is no shared global state between requests.
 */
export function formatDate(value: string | null | undefined): string {
  return formatDateWith(value, page.data?.settings)
}

/** Today's date, long form, in the site's language and timezone (used in the top bar). */
export function formatToday(): string {
  return formatDateWith(new Date().toISOString(), { ...page.data?.settings, date_format: 'l, j F Y' })
}
