import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const THEMES_DIR = join(__dirname, '..', '..', '..', '..', 'themes')

export interface ThemeStorage {
  listSlugs(): Promise<string[]>
  exists(slug: string): Promise<boolean>
  readFile(slug: string, filePath: string): Promise<string | null>
  createDir(slug: string): Promise<void>
  writeFile(slug: string, filePath: string, data: Uint8Array): Promise<void>
}

class LocalThemeStorage implements ThemeStorage {
  async listSlugs(): Promise<string[]> {
    if (!existsSync(THEMES_DIR)) return []
    return readdirSync(THEMES_DIR).filter(e => {
      try { return statSync(join(THEMES_DIR, e)).isDirectory() }
      catch { return false }
    })
  }

  async exists(slug: string): Promise<boolean> {
    return existsSync(join(THEMES_DIR, slug))
  }

  async readFile(slug: string, filePath: string): Promise<string | null> {
    const fullPath = join(THEMES_DIR, slug, filePath)
    if (!existsSync(fullPath)) return null
    return readFileSync(fullPath, 'utf-8')
  }

  async createDir(slug: string): Promise<void> {
    const dir = join(THEMES_DIR, slug)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }

  async writeFile(slug: string, filePath: string, data: Uint8Array): Promise<void> {
    const targetPath = join(THEMES_DIR, slug, filePath)
    const targetDir = dirname(targetPath)
    if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
    writeFileSync(targetPath, data)
  }
}

class R2ThemeStorage implements ThemeStorage {
  private r2: any

  constructor(r2: any) {
    this.r2 = r2
  }

  async listSlugs(): Promise<string[]> {
    const slugs = new Set<string>()
    let cursor: string | undefined
    do {
      const result = await this.r2.list({ prefix: 'themes/', cursor })
      for (const obj of result.objects) {
        const parts = obj.key.replace('themes/', '').split('/')
        if (parts[0]) slugs.add(parts[0])
      }
      cursor = result.truncated ? result.cursor : undefined
    } while (cursor)
    return [...slugs]
  }

  async exists(slug: string): Promise<boolean> {
    const obj = await this.r2.get(`themes/${slug}/manifest.json`)
    return obj !== null
  }

  async readFile(slug: string, filePath: string): Promise<string | null> {
    const obj = await this.r2.get(`themes/${slug}/${filePath}`)
    if (!obj) return null
    return obj.text()
  }

  async createDir(_slug: string): Promise<void> {}

  async writeFile(slug: string, filePath: string, data: Uint8Array): Promise<void> {
    await this.r2.put(`themes/${slug}/${filePath}`, data)
  }
}

let storage: ThemeStorage | null = null

export function getThemeStorage(platform?: App.Platform): ThemeStorage {
  if (storage) return storage

  const isCfWorker = typeof process === 'undefined' || !process.versions?.node
  if (isCfWorker && platform?.env?.R2) {
    storage = new R2ThemeStorage(platform.env.R2)
  } else {
    storage = new LocalThemeStorage()
  }
  return storage
}
