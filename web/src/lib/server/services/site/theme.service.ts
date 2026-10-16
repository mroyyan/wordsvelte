import { settings } from '@wordsvelte/shared'
import { NotFoundError } from '$lib/server/core/errors'
import { listThemes as _listThemes, scanThemes as _scanThemes, setActiveTheme } from '$lib/server/themes'
import { assertThemeSlug } from '$lib/server/themes/paths'
import { getThemeStorage } from '$lib/server/themes/storage'

export async function listThemes(platform?: App.Platform) {
	return _listThemes(platform)
}

export async function scanThemes(platform?: App.Platform) {
	return _scanThemes(platform)
}

export async function activateTheme(db: any, slug: string, platform?: App.Platform) {
	assertThemeSlug(slug)
	if (!(await getThemeStorage(platform).exists(slug))) throw new NotFoundError('Theme')

	await db.insert(settings)
		.values({ key: 'theme', value: slug })
		.onConflictDoUpdate({ target: settings.key, set: { value: slug } })

	await setActiveTheme(slug, platform)
}
