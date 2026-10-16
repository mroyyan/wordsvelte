/**
 * Guards the layering of src/lib/server so it cannot erode silently:
 *
 *   routes -> services -> repositories -> db
 *                 \-> auth, mail, seo, storage, themes, http, core
 *
 * - only repositories (and db/) talk to Drizzle and the schema tables;
 * - every layer may only import the layers listed below it.
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from '@wordsvelte/shared'

const WEB = resolve(__dirname, '../..')
const SERVER = join(WEB, 'src/lib/server')
const ROUTES = join(WEB, 'src/routes')

const norm = (p: string) => p.replace(/\\/g, '/')

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|svelte)$/.test(f)) out.push(p)
  }
  return out
}

/** "services/content", "repositories", "core", ... for a file under src/lib/server. */
function layerOf(file: string): string {
  const parts = norm(relative(SERVER, file)).split('/')
  if (parts[0] === 'services') return `services/${parts[1]}`
  // a spec such as '$lib/server/db' resolves to a folder or to db.ts: either way the layer is 'db'
  return parts[0].replace(/.ts$/, '')
}

/** Every module specifier imported by a file ('from "x"' and dynamic import("x")). */
function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const found = [...src.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(m => m[1])
  return found
}

/** Resolve an import to a layer of src/lib/server, or null when it points elsewhere. */
function serverLayerOfImport(from: string, spec: string): string | null {
  let abs: string | null = null
  if (spec.startsWith('$lib/server/')) abs = join(SERVER, spec.slice('$lib/server/'.length))
  else if (spec.startsWith('.')) abs = resolve(dirname(from), spec)
  if (!abs || !norm(abs).startsWith(norm(SERVER) + '/')) return null
  return layerOf(abs + '.ts')
}

const CORE = ['core']
const ALLOWED: Record<string, string[]> = {
  core: [...CORE],
  http: [...CORE, 'http'],
  db: [...CORE, 'db'],
  repositories: [...CORE, 'db', 'repositories'],
  auth: [...CORE, 'db', 'repositories', 'auth'],
  mail: [...CORE, 'mail'],
  storage: [...CORE, 'db', 'storage'],
  themes: [...CORE, 'themes', 'storage'],
  seo: [...CORE, 'db', 'repositories', 'seo', 'services/site'],
}
const SERVICES = [...CORE, 'db', 'repositories', 'auth', 'mail', 'seo', 'storage', 'themes', 'services/account', 'services/content', 'services/site']

const allowedFor = (layer: string) => ALLOWED[layer] ?? (layer.startsWith('services/') ? SERVICES : null)

const serverFiles = walk(SERVER).filter(f => !f.endsWith('.d.ts'))

describe('layering of src/lib/server', () => {
  it('knows every layer', () => {
    const unknown = [...new Set(serverFiles.map(layerOf))].filter(l => !allowedFor(l))
    expect(unknown, 'add the new folder to ALLOWED in this test').toEqual([])
  })

  it('only imports layers it is allowed to depend on', () => {
    const violations: string[] = []
    for (const file of serverFiles) {
      const layer = layerOf(file)
      const allowed = allowedFor(layer)!
      for (const spec of importsOf(file)) {
        const target = serverLayerOfImport(file, spec)
        if (target && target !== layer && !allowed.includes(target)) violations.push(`${norm(relative(SERVER, file))} (${layer}) imports ${spec} (${target})`)
      }
    }
    expect(violations).toEqual([])
  })

  it('never reaches up into routes or components', () => {
    const bad = serverFiles.filter(f => importsOf(f).some(s => /^\$lib\/components|\/routes\//.test(s)))
    expect(bad.map(f => norm(relative(SERVER, f)))).toEqual([])
  })
})

// Read-models that still query tables themselves. This list may only shrink: a file that no longer needs to be here fails the test below.
const SQL_EXCEPTIONS = new Set([
  'services/site/dashboard.service.ts', // reporting aggregates across every table
  'services/site/migrate.service.ts', // bulk import from a WordPress export
  'seo/sitemap.ts', // sitemap queries
])

const TABLES = Object.entries(schema).filter(([, v]) => v instanceof SQLiteTable).map(([k]) => k)

function touchesSql(file: string): boolean {
  const src = readFileSync(file, 'utf8')
  if (/from\s+['"]drizzle-orm(\/[^'"]*)?['"]/.test(src.replace(/import type[^\n]*\n/g, ''))) return true
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@wordsvelte\/shared['"]/g)) {
    const names = m[1].split(',').map(s => s.trim().replace(/^type\s+.*/, '').split(/\s+as\s+/)[0]).filter(Boolean)
    if (names.some(n => TABLES.includes(n))) return true
  }
  return false
}

describe('persistence stays in repositories', () => {
  const candidates = [...serverFiles, ...walk(ROUTES)].filter(f => !/[\\/](repositories|db)[\\/]/.test(f) && !f.endsWith('.svelte'))

  it('no service, route or helper builds SQL or touches a table (outside the listed read-models)', () => {
    const offenders = candidates.filter(touchesSql).map(f => norm(relative(SERVER, f))).filter(r => !SQL_EXCEPTIONS.has(r))
    expect(offenders).toEqual([])
  })

  it('the exception list contains no file that has already been cleaned up', () => {
    const stale = [...SQL_EXCEPTIONS].filter(r => !touchesSql(join(SERVER, r)))
    expect(stale).toEqual([])
  })

  it('repositories take a db and nothing else from the request', () => {
    const repos = walk(join(SERVER, 'repositories'))
    const bad = repos.filter(f => /RequestEvent|\$app\/|@sveltejs\/kit/.test(readFileSync(f, 'utf8')))
    expect(bad.map(f => norm(relative(SERVER, f)))).toEqual([])
  })
})
