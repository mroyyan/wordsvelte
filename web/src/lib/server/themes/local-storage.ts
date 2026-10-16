import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname, resolve, sep } from 'path'
import { fileURLToPath } from 'url'
import { assertSafeRelativePath, assertThemeSlug } from './paths'
import type { ThemeStorage } from './storage'

// Node-only: loaded dynamically in dev; never part of the Cloudflare bundle.
const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_THEMES_DIR = join(here, '..', '..', '..', '..', 'themes')

export class LocalThemeStorage implements ThemeStorage {
  private root: string

  constructor(root: string = DEFAULT_THEMES_DIR) {
    this.root = resolve(root)
  }

  /** Resolve inside the themes root; the prefix check is a second line of defence behind path validation. */
  private resolveInside(slug: string, filePath?: string): string {
    assertThemeSlug(slug)
    const full = resolve(this.root, slug, filePath ? assertSafeRelativePath(filePath) : '')
    if (full !== resolve(this.root, slug) && !full.startsWith(resolve(this.root, slug) + sep)) {
      throw new Error('Path escapes theme directory')
    }
    return full
  }

  async listSlugs(): Promise<string[]> {
    if (!existsSync(this.root)) return []
    return readdirSync(this.root).filter(e => {
      try { return statSync(join(this.root, e)).isDirectory() } catch { return false }
    })
  }

  async exists(slug: string) { return existsSync(this.resolveInside(slug)) }

  async readFile(slug: string, filePath: string) {
    const full = this.resolveInside(slug, filePath)
    return existsSync(full) ? readFileSync(full, 'utf-8') : null
  }

  async createDir(slug: string) {
    mkdirSync(this.resolveInside(slug), { recursive: true })
  }

  async writeFile(slug: string, filePath: string, data: Uint8Array) {
    const target = this.resolveInside(slug, filePath)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, data)
  }
}
