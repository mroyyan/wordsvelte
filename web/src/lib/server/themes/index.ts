import Handlebars from 'handlebars'
import DOMPurify from 'isomorphic-dompurify'
import { getThemeStorage } from './storage'

const RENDER_TIMEOUT_MS = 1000

type ThemeCache = {
  manifest: any
  layout: HandlebarsTemplateDelegate
  templates: Record<string, HandlebarsTemplateDelegate>
  css: string
}

const cache = new Map<string, ThemeCache>()
let activeTheme: string | null = null

Handlebars.registerHelper('eq', (a: any, b: any) => a === b)
Handlebars.registerHelper('add', (a: number, b: number) => a + b)
Handlebars.registerHelper('slice', (arr: any[], start: number, end: number) => arr?.slice(start, end) || [])
Handlebars.registerHelper('sortByViewCount', (arr: any[], limit: number) =>
  [...(arr || [])].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, limit)
)
Handlebars.registerHelper('sortByDate', (arr: any[], limit: number) =>
  [...(arr || [])].sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime()).slice(0, limit)
)
Handlebars.registerHelper('truncate', (str: string, len: number) => {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '...' : str
})
Handlebars.registerHelper('formatDate', (date: string) => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
})

async function loadTheme(slug: string, platform?: App.Platform): Promise<ThemeCache | null> {
  const store = getThemeStorage(platform)
  if (!(await store.exists(slug))) return null

  const manifestRaw = await store.readFile(slug, 'manifest.json')
  if (!manifestRaw) return null
  const manifest = JSON.parse(manifestRaw)

  const layoutSource = await store.readFile(slug, 'templates/layout.hbs')
  if (!layoutSource) return null

  const layout = Handlebars.compile(layoutSource)

  const templates: Record<string, HandlebarsTemplateDelegate> = {}
  const slugs = await store.listSlugs()
  if (slugs.includes(slug)) {
    const templateFiles = ['index.hbs']
    for (const file of templateFiles) {
      const source = await store.readFile(slug, `templates/${file}`)
      if (source) {
        templates[file.replace('.hbs', '')] = Handlebars.compile(source)
      }
    }
  }

  const css = (await store.readFile(slug, 'assets/style.css')) || ''

  const result: ThemeCache = { manifest, layout, templates, css }
  cache.set(slug, result)
  return result
}

export function getActiveTheme(): string | null {
  return activeTheme
}

export async function setActiveTheme(slug: string, platform?: App.Platform) {
  activeTheme = slug
  if (!cache.has(slug)) await loadTheme(slug, platform)
}

export async function listThemes(platform?: App.Platform): Promise<any[]> {
  const store = getThemeStorage(platform)
  const slugs = await store.listSlugs()
  const result: any[] = []
  for (const slug of slugs) {
    const manifestRaw = await store.readFile(slug, 'manifest.json')
    if (!manifestRaw) continue
    try {
      const manifest = JSON.parse(manifestRaw)
      result.push({ ...manifest, slug, active: slug === activeTheme })
    } catch {}
  }
  return result
}

export async function scanThemes(platform?: App.Platform) {
  cache.clear()
  const store = getThemeStorage(platform)
  const slugs = await store.listSlugs()
  for (const slug of slugs) {
    await loadTheme(slug, platform)
  }
}

function renderWithTimeout(fn: () => string, timeoutMs: number): string {
  const start = Date.now()
  const result = fn()
  if (Date.now() - start > timeoutMs) {
    throw new Error(`Theme render exceeded ${timeoutMs}ms limit`)
  }
  return result
}

export async function renderPage(templateName: string, data: Record<string, any>, platform?: App.Platform): Promise<string | null> {
  const slug = activeTheme || 'default'
  if (!cache.has(slug)) await loadTheme(slug, platform)
  const theme = cache.get(slug)
  if (!theme) return null

  const tmpl = theme.templates[templateName] || theme.templates['index']
  if (!tmpl) return null

  let bodyHtml: string
  try {
    bodyHtml = renderWithTimeout(() => tmpl(data), RENDER_TIMEOUT_MS)
  } catch (e: any) {
    console.error('Theme render error:', e.message)
    bodyHtml = `<div class="p-8 text-center text-red-500 text-sm">Render error</div>`
  }
  try {
    return theme.layout({ ...data, body: bodyHtml, theme_css: theme.css })
  } catch (e: any) {
    console.error('Layout render error:', e.message)
    return `<!DOCTYPE html><html><body><div class="p-8 text-center text-red-500">Layout error</div></body></html>`
  }
}

export function prepareThemeData(layoutData: any, pageData: any = {}): Record<string, any> {
  const menus = layoutData.menus || []
  const headerMenu = menus.find((m: any) => m.location === 'header')
  const headerMenuTree = buildTree(headerMenu?.items || [])

  const allWidgets = layoutData.widgets || []
  const settings = layoutData.settings || {}

  return {
    site_name: settings.site_name || 'WordSvelte',
    meta_description: settings.default_meta_description || '',
    settings,
    today: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    current_year: new Date().getFullYear(),
    header_menu_items: headerMenuTree,
    sidebar_widgets: allWidgets.filter((w: any) => w.sidebarArea === 'sidebar-1').map((w: any) => ({
      ...w,
      content: w.widgetType === 'html' ? DOMPurify.sanitize(w.content || '') : w.content,
    })),
    categories: pageData.categories || [],
    tags: pageData.tags || [],
    posts: pageData.posts || [],
    post: pageData.post || null,
    query: pageData.query || '',
    results: pageData.results || [],
    theme_css: '',
    ...pageData,
  }
}

function buildTree(items: any[]) {
  const itemMap = new Map<number, any>()
  for (const item of items) {
    if (item.status !== 'active') continue
    itemMap.set(item.id, { label: item.label, url: item.url || '#', children: [] })
  }
  const result: any[] = []
  for (const item of items) {
    if (item.status !== 'active') continue
    const node = itemMap.get(item.id)!
    if (item.parentId && itemMap.has(item.parentId)) {
      itemMap.get(item.parentId)!.children.push(node)
    } else if (!item.parentId) {
      result.push(node)
    }
  }
  return result
}
