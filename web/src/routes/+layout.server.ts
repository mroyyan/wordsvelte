import { getDb } from '$lib/server/db'
import { widgets } from '@wordsvelte/shared'
import { getPublicMenus } from '$lib/server/services/menu.service'
import { getSettings } from '$lib/server/services/settings.service'
import { siteOrigin } from '$lib/seo'
import { asc, eq } from 'drizzle-orm'
import { scanThemes, setActiveTheme } from '$lib/server/themes'

export async function load(event) {
  const db = getDb(event as any)
  
  // Public scope only: this object is serialised into every page, so it must never contain secrets.
  const settingsMap = await getSettings(db)

  const allWidgets = await db.select().from(widgets)
    .where(eq(widgets.status, 'active'))
    .orderBy(asc(widgets.sortOrder))

  // Page-type items are resolved to their current slug; unpublished/missing pages are dropped.
  const menuResults = await getPublicMenus(db)

  // Set active theme
  const themeSlug = settingsMap['theme'] || 'default'
  await scanThemes((event as any).platform)
  await setActiveTheme(themeSlug, (event as any).platform)

  return {
    settings: settingsMap,
    siteUrl: siteOrigin(settingsMap.site_url, event.url.origin),
    widgets: allWidgets,
    menus: menuResults,
    theme: themeSlug,
  }
}

