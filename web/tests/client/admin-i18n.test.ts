/**
 * Keeps the admin translations honest. The admin is written in English: every user-facing text goes through `tr('...')` (or is marked with
 * `msg('...')` in a config file), and the Indonesian catalogs under src/lib/i18n/admin/ map that exact English text to its translation.
 * This test finds every such literal in the source and checks the catalogs against it.
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { adminCatalogParts, adminCatalogs } from '../../src/lib/i18n/admin/catalogs'
import { fill } from '../../src/lib/i18n/translator'

const SRC = resolve(__dirname, '../../src')
const SKIP_DIRS = new Set(['i18n'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) walk(p, out) }
    else if (/\.(svelte|ts)$/.test(name) && !name.endsWith('.d.ts')) out.push(p)
  }
  return out
}

const unescape = (s: string) => s.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n')
const CALL = /(?<![\w$.])(?:tr|msg)\(\s*(['"])((?:\\.|(?!\1)[^\\\n])*)\1/g
const TEMPLATE_CALL = /(?<![\w$.])(?:tr|msg)\(\s*`/

const used = new Map<string, string[]>() // text -> files
const templateLiterals: string[] = []
for (const file of walk(SRC)) {
  const src = readFileSync(file, 'utf8')
  const rel = relative(SRC, file).replace(/\\/g, '/')
  if (TEMPLATE_CALL.test(src)) templateLiterals.push(rel)
  for (const m of src.matchAll(CALL)) {
    const text = unescape(m[2])
    used.set(text, [...(used.get(text) ?? []), rel])
  }
}

const id = adminCatalogs.id
const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort()

describe('admin translations', () => {
  it('finds the texts (the scan itself works)', () => {
    expect(used.size).toBeGreaterThan(0)
  })

  it('tr() and msg() take a plain string, never a template literal (it could not be matched to the catalog)', () => {
    expect(templateLiterals).toEqual([])
  })

  it('every text used in the source has an Indonesian translation', () => {
    const missing = [...used.keys()].filter(text => !(text in id)).map(text => `${text}   (${used.get(text)![0]})`)
    expect(missing).toEqual([])
  })

  it('the catalog holds nothing the source no longer uses', () => {
    expect(Object.keys(id).filter(text => !used.has(text))).toEqual([])
  })

  it('a text appears in only one catalog file', () => {
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const part of adminCatalogParts) for (const key of Object.keys(part)) { if (seen.has(key)) duplicates.push(key); seen.add(key) }
    expect(duplicates).toEqual([])
  })

  it('a translation keeps the {placeholders} of the English text and is not empty', () => {
    const problems = Object.entries(id).filter(([text, translated]) => !translated.trim() || placeholders(text).join() !== placeholders(translated).join())
    expect(problems.map(([text]) => text)).toEqual([])
  })

  it('placeholders are filled once, without re-reading the inserted text', () => {
    expect(fill('{n} files, {name}', { n: 3, name: '{n}' })).toBe('3 files, {n}')
  })
})
