import { assertSafeRelativePath, assertThemeSlug } from './paths'

export interface ThemeStorage {
  listSlugs(): Promise<string[]>
  exists(slug: string): Promise<boolean>
  readFile(slug: string, filePath: string): Promise<string | null>
  createDir(slug: string): Promise<void>
  writeFile(slug: string, filePath: string, data: Uint8Array): Promise<void>
}

/** Cloudflare R2: themes live under the `themes/<slug>/` prefix. */
export class R2ThemeStorage implements ThemeStorage {
  constructor(private r2: any) {}

  async listSlugs(): Promise<string[]> {
    const slugs = new Set<string>()
    let cursor: string | undefined
    do {
      const result = await this.r2.list({ prefix: 'themes/', cursor })
      for (const obj of result.objects) {
        const first = obj.key.slice('themes/'.length).split('/')[0]
        if (first) slugs.add(first)
      }
      cursor = result.truncated ? result.cursor : undefined
    } while (cursor)
    return [...slugs]
  }

  async exists(slug: string): Promise<boolean> {
    assertThemeSlug(slug)
    return (await this.r2.get(`themes/${slug}/manifest.json`)) !== null
  }

  async readFile(slug: string, filePath: string): Promise<string | null> {
    assertThemeSlug(slug)
    const obj = await this.r2.get(`themes/${slug}/${assertSafeRelativePath(filePath)}`)
    return obj ? obj.text() : null
  }

  async createDir(slug: string): Promise<void> {
    assertThemeSlug(slug)
  }

  async writeFile(slug: string, filePath: string, data: Uint8Array): Promise<void> {
    assertThemeSlug(slug)
    await this.r2.put(`themes/${slug}/${assertSafeRelativePath(filePath)}`, data)
  }
}

// The default theme ships inside the bundle so a fresh deploy renders before anything is uploaded to R2.
const bundledFiles = import.meta.glob('../../../../themes/default/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const BUNDLED_PREFIX = '../../../../themes/default/'
const bundled = new Map<string, string>(
  Object.entries(bundledFiles).map(([k, v]) => [k.slice(BUNDLED_PREFIX.length), v]),
)

export const BUNDLED_THEME_SLUG = 'default'

/** Read-only storage backed by the files bundled at build time. */
export class BundledThemeStorage implements ThemeStorage {
  async listSlugs() { return bundled.size ? [BUNDLED_THEME_SLUG] : [] }
  async exists(slug: string) { return slug === BUNDLED_THEME_SLUG && bundled.has('manifest.json') }
  async readFile(slug: string, filePath: string) {
    return slug === BUNDLED_THEME_SLUG ? (bundled.get(assertSafeRelativePath(filePath)) ?? null) : null
  }
  async createDir(): Promise<void> { throw new Error('Bundled themes are read-only') }
  async writeFile(): Promise<void> { throw new Error('Bundled themes are read-only') }
}

/** Reads/writes go to `primary`; reads fall back to the bundled default theme. */
export class LayeredThemeStorage implements ThemeStorage {
  constructor(private primary: ThemeStorage, private fallback: ThemeStorage = new BundledThemeStorage()) {}

  async listSlugs() { return [...new Set([...(await this.primary.listSlugs()), ...(await this.fallback.listSlugs())])] }
  async exists(slug: string) { return (await this.primary.exists(slug)) || (await this.fallback.exists(slug)) }
  async readFile(slug: string, filePath: string) {
    return (await this.primary.readFile(slug, filePath)) ?? (await this.fallback.readFile(slug, filePath))
  }
  createDir(slug: string) { return this.primary.createDir(slug) }
  writeFile(slug: string, filePath: string, data: Uint8Array) { return this.primary.writeFile(slug, filePath, data) }
}

let storage: ThemeStorage | null = null
let localStorageInstance: ThemeStorage | null = null

export function setThemeStorage(s: ThemeStorage | null) {
  storage = s
}

/** Local dev only (statically removed from production builds, like ensureLocalDb). */
export async function ensureLocalThemeStorage() {
  if (localStorageInstance || !import.meta.env.DEV) return
  const { LocalThemeStorage } = await import('./local-storage')
  localStorageInstance = new LayeredThemeStorage(new LocalThemeStorage())
}

export function getThemeStorage(platform?: App.Platform): ThemeStorage {
  if (storage) return storage
  // `vite dev` also exposes an emulated R2 binding; in dev the themes folder on disk is the source of truth.
  if (import.meta.env.DEV && localStorageInstance) return localStorageInstance
  if (platform?.env?.R2) {
    storage = new LayeredThemeStorage(new R2ThemeStorage(platform.env.R2))
    return storage
  }
  return localStorageInstance ?? new BundledThemeStorage()
}
