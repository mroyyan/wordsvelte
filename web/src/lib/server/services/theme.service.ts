import { settings } from '@wordsvelte/shared'
import { eq } from 'drizzle-orm'
import { listThemes as _listThemes, scanThemes as _scanThemes, setActiveTheme } from '$lib/server/themes'

export async function listThemes(platform?: App.Platform) {
	return _listThemes(platform)
}

export async function scanThemes(platform?: App.Platform) {
	return _scanThemes(platform)
}

export async function activateTheme(db: any, slug: string, platform?: App.Platform) {
	await db.insert(settings)
		.values({ key: 'theme', value: slug })
		.onConflictDoUpdate({ target: settings.key, set: { value: slug } })

	await setActiveTheme(slug, platform)
}
