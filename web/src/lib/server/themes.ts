import Handlebars from 'handlebars'
import DOMPurify from 'isomorphic-dompurify'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const RENDER_TIMEOUT_MS = 1000

const __dirname = dirname(fileURLToPath(import.meta.url))
const THEMES_DIR = join(__dirname, '..', '..', '..', 'themes')

type ThemeCache = {
  manifest: any
  layout: HandlebarsTemplateDelegate
  templates: Record<string, HandlebarsTemplateDelegate>
  css: string
}

const cache = new Map<string, ThemeCache>()
let activeTheme: string | null = null

// Register Handlebars helpers
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

function loadTheme(slug: string): ThemeCache | null {
  const themeDir = join(THEMES_DIR, slug)
  if (!existsSync(themeDir)) return null

  const manifestPath = join(themeDir, 'manifest.json')
  if (!existsSync(manifestPath)) return null

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const templatesDir = join(themeDir, 'templates')

  const layoutPath = join(templatesDir, 'layout.hbs')
  if (!existsSync(layoutPath)) return null

  const layoutSource = readFileSync(layoutPath, 'utf-8')
  const layout = Handlebars.compile(layoutSource)

  const templates: Record<string, HandlebarsTemplateDelegate> = {}
  if (existsSync(templatesDir)) {
    const files = readdirSync(templatesDir)
    for (const file of files) {
      if (file.endsWith('.hbs') && file !== 'layout.hbs') {
        const name = file.replace('.hbs', '')
        const source = readFileSync(join(templatesDir, file), 'utf-8')
        templates[name] = Handlebars.compile(source)
      }
    }
  }

  const cssPath = join(themeDir, 'assets', 'style.css')
  const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf-8') : ''

  const result: ThemeCache = { manifest, layout, templates, css }
  cache.set(slug, result)
  return result
}

export function getActiveTheme(): string | null {
  return activeTheme
}

export function setActiveTheme(slug: string) {
  activeTheme = slug
  if (!cache.has(slug)) loadTheme(slug)
}

export function listThemes(): any[] {
  if (!existsSync(THEMES_DIR)) return []
  const entries = readdirSync(THEMES_DIR)
  const result: any[] = []
  for (const entry of entries) {
    const dir = join(THEMES_DIR, entry)
    if (!statSync(dir).isDirectory()) continue
    const manifestPath = join(dir, 'manifest.json')
    if (!existsSync(manifestPath)) continue
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      result.push({ ...manifest, slug: entry, active: entry === activeTheme })
    } catch {}
  }
  return result
}

export function scanThemes() {
  cache.clear()
  if (!existsSync(THEMES_DIR)) return
  const entries = readdirSync(THEMES_DIR)
  for (const entry of entries) {
    const dir = join(THEMES_DIR, entry)
    if (statSync(dir).isDirectory()) loadTheme(entry)
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

export function renderPage(templateName: string, data: Record<string, any>): string | null {
  const slug = activeTheme || 'default'
  if (!cache.has(slug)) loadTheme(slug)
  const theme = cache.get(slug)
  if (!theme) return null

  const tmpl = theme.templates[templateName] || theme.templates['index']
  if (!tmpl) return null

  let bodyHtml: string
  try {
    bodyHtml = renderWithTimeout(() => tmpl(data), RENDER_TIMEOUT_MS)
  } catch (e: any) {
    console.error('Theme render error:', e.message)
    bodyHtml = `<div class="p-8 text-center text-red-500 text-sm">Render error: ${e.message}</div>`
  }
  try {
    return theme.layout({ ...data, body: bodyHtml })
  } catch (e: any) {
    console.error('Layout render error:', e.message)
    return `<!DOCTYPE html><html><body><div class="p-8 text-center text-red-500">Layout error: ${e.message}</div></body></html>`
  }
}

// Static helper: prepare common data for templates
export function prepareThemeData(layoutData: any, pageData: any = {}): Record<string, any> {
  const menus = layoutData.menus || []
  const headerMenu = menus.find((m: any) => m.location === 'header')
  const headerMenuTree = buildTree(headerMenu?.items || [])

  const allWidgets = layoutData.widgets || []
  const settings = layoutData.settings || {}

  return {
    site_name: settings.site_name || 'Kubus News',
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
  const roots = items.filter((i: any) => !i.parentId && i.status === 'active').map(i => ({
    label: i.label,
    url: i.url || '#',
    children: [] as any[]
  }))
  for (const root of roots) {
    root.children = items.filter((i: any) => i.parentId && i.status === 'active' && items.find((x: any) => x.id === i.parentId)?.label === root.label)
      .map(c => ({ label: c.label, url: c.url || '#' }))
  }
  // Alternative: match by parentId properly
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
