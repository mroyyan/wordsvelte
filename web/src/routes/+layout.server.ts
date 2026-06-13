import { getDb } from '$lib/server/db'
import { widgets, menus, menuItems, settings } from '@wordsvelte/shared'
import { and, asc, eq } from 'drizzle-orm'
import { scanThemes, setActiveTheme } from '$lib/server/themes'

export async function load(event) {
  const db = getDb(event as any)
  
  const allSettings = await db.select().from(settings)
  const settingsMap: Record<string, string> = {}
  for (const s of allSettings) settingsMap[s.key] = s.value

  const allWidgets = await db.select().from(widgets)
    .where(eq(widgets.status, 'active'))
    .orderBy(asc(widgets.sortOrder))

  const allMenus = await db.select().from(menus)
    .where(eq(menus.status, 'active'))
    .orderBy(asc(menus.name))

  const menuResults = []
  for (const menu of allMenus) {
    const items = await db.select().from(menuItems)
      .where(and(eq(menuItems.menuId, menu.id), eq(menuItems.status, 'active')))
      .orderBy(asc(menuItems.sortOrder))
    menuResults.push({ ...menu, items })
  }

  // Set active theme
  const themeSlug = settingsMap['theme'] || 'default'
  await scanThemes((event as any).platform)
  await setActiveTheme(themeSlug, (event as any).platform)

  return {
    settings: settingsMap,
    widgets: allWidgets,
    menus: menuResults,
    theme: themeSlug,
  }
}

