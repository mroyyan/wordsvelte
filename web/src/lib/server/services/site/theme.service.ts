import type { DbInstance } from '$lib/server/db'
import { NotFoundError } from '$lib/server/core/errors'
import { createSettingsRepository } from '$lib/server/repositories/settings.repository'
import { listThemes as _listThemes, scanThemes as _scanThemes, setActiveTheme } from '$lib/server/themes'
import { assertThemeSlug } from '$lib/server/themes/paths'
import { getThemeStorage } from '$lib/server/themes/storage'

export async function listThemes(platform?: App.Platform) {
	return _listThemes(platform)
}

export async function scanThemes(platform?: App.Platform) {
	return _scanThemes(platform)
}

export async function activateTheme(db: DbInstance, slug: string, platform?: App.Platform) {
	assertThemeSlug(slug)
	if (!(await getThemeStorage(platform).exists(slug))) throw new NotFoundError('Theme')

	await createSettingsRepository(db).upsert('theme', slug)

	await setActiveTheme(slug, platform)
}
