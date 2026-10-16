import AdmZip from 'adm-zip'
import Handlebars from 'handlebars'
import { toSlug } from '@wordsvelte/shared'
import { ValidationError } from '$lib/server/core/errors'
import { THEME_SLUG_RE, safeRelativePath } from './paths'

export const MAX_ZIP_BYTES = 10 * 1024 * 1024
export const MAX_THEME_FILES = 300
export const MAX_THEME_UNCOMPRESSED_BYTES = 20 * 1024 * 1024
export const MAX_THEME_FILE_BYTES = 5 * 1024 * 1024

const ALLOWED_EXTENSIONS = new Set([
  'hbs', 'json', 'css', 'md', 'txt',
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'svg', 'woff', 'woff2',
])

export interface ParsedTheme {
  slug: string
  manifest: { name: string; version?: string; [k: string]: unknown }
  files: { path: string; data: Uint8Array }[]
}

/** Validate a theme archive and return its files with safe relative paths. Nothing is written here. */
export function parseThemeZip(buffer: Uint8Array, fallbackName: string): ParsedTheme {
  if (buffer.byteLength > MAX_ZIP_BYTES) throw new ValidationError('File too large (max 10MB)')

  let entries: AdmZip.IZipEntry[]
  try {
    entries = new AdmZip(Buffer.from(buffer)).getEntries().filter(e => !e.isDirectory)
  } catch {
    throw new ValidationError('Invalid zip archive')
  }
  entries = entries.filter(e => !e.entryName.startsWith('__MACOSX/') && !e.entryName.endsWith('.DS_Store'))
  if (entries.length === 0) throw new ValidationError('Zip archive is empty')
  if (entries.length > MAX_THEME_FILES) throw new ValidationError(`Too many files (max ${MAX_THEME_FILES})`)

  // Everything may sit inside one top-level folder (as produced by "zip folder/").
  const names = entries.map(e => e.entryName.replace(/\\/g, '/'))
  const firstSegments = new Set(names.map(n => n.split('/')[0]))
  const stripPrefix = firstSegments.size === 1 && names.every(n => n.includes('/')) ? [...firstSegments][0] + '/' : ''

  const files: ParsedTheme['files'] = []
  const seen = new Set<string>()
  let total = 0
  for (let i = 0; i < entries.length; i++) {
    const rel = safeRelativePath(stripPrefix ? names[i].slice(stripPrefix.length) : names[i])
    if (!rel) throw new ValidationError(`Unsafe path in archive: ${names[i].slice(0, 80)}`)
    const ext = rel.includes('.') ? rel.split('.').pop()!.toLowerCase() : ''
    if (!ALLOWED_EXTENSIONS.has(ext)) throw new ValidationError(`File type not allowed: ${rel}`)
    if (seen.has(rel)) throw new ValidationError(`Duplicate file in archive: ${rel}`)
    seen.add(rel)

    // Declared sizes can lie (zip bombs), so also check the real decompressed length.
    if (entries[i].header.size > MAX_THEME_FILE_BYTES) throw new ValidationError(`File too large: ${rel}`)
    let data: Buffer
    try { data = entries[i].getData() } catch { throw new ValidationError(`Corrupt file in archive: ${rel}`) }
    if (data.byteLength > MAX_THEME_FILE_BYTES) throw new ValidationError(`File too large: ${rel}`)
    total += data.byteLength
    if (total > MAX_THEME_UNCOMPRESSED_BYTES) throw new ValidationError('Theme is too large when extracted (max 20MB)')
    files.push({ path: rel, data: new Uint8Array(data) })
  }

  const manifestFile = files.find(f => f.path === 'manifest.json')
  if (!manifestFile) throw new ValidationError('manifest.json not found in zip root')
  let manifest: any
  try { manifest = JSON.parse(new TextDecoder().decode(manifestFile.data)) } catch { throw new ValidationError('Invalid manifest.json') }
  if (!manifest || typeof manifest !== 'object' || typeof manifest.name !== 'string' || !manifest.name.trim()) {
    throw new ValidationError('manifest.json must contain a "name"')
  }
  if (!files.some(f => f.path === 'templates/layout.hbs')) throw new ValidationError('templates/layout.hbs is required')

  for (const f of files.filter(f => f.path.endsWith('.hbs'))) {
    try {
      Handlebars.precompile(new TextDecoder().decode(f.data))
    } catch (e: any) {
      throw new ValidationError(`Template syntax error in ${f.path}: ${String(e.message).split('\n')[0].slice(0, 120)}`)
    }
  }

  const slug = typeof manifest.slug === 'string' && manifest.slug ? manifest.slug : toSlug(fallbackName.replace(/\.zip$/i, ''))
  if (!THEME_SLUG_RE.test(slug)) throw new ValidationError('Invalid theme slug (use lowercase letters, numbers and dashes)')

  return { slug, manifest, files }
}
