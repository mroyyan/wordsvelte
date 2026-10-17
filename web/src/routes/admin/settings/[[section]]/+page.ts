import { error } from '@sveltejs/kit'
import { SETTINGS_SECTION_IDS } from '$lib/config/settings-sections'

export function load({ params }) {
  const section = params.section ?? 'general'
  // "/admin/settings/general" would be a second URL for the root page
  if (params.section === 'general' || !SETTINGS_SECTION_IDS.includes(section)) throw error(404, 'Settings section not found')
  return { section }
}
