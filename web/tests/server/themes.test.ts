import { describe, it, expect, afterAll } from 'vitest'
import AdmZip from 'adm-zip'
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { eq } from 'drizzle-orm'
import { settings } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { assertThemeSlug, safeRelativePath, assertSafeRelativePath } from '$lib/server/themes/paths'
import { parseThemeZip, MAX_THEME_FILES, MAX_THEME_FILE_BYTES } from '$lib/server/themes/zip'
import {
  R2ThemeStorage, BundledThemeStorage, LayeredThemeStorage, getThemeStorage, setThemeStorage,
} from '$lib/server/themes/storage'
import { LocalThemeStorage } from '$lib/server/themes/local-storage'
import { listThemes, activateTheme } from '$lib/server/services/site/theme.service'
import { renderPage, setActiveTheme } from '$lib/server/themes'
import { ValidationError, NotFoundError } from '$lib/server/core/errors'
import { GET as listRoute, POST as scanRoute } from '../../src/routes/api/themes/+server'
import { POST as uploadRoute } from '../../src/routes/api/themes/upload/+server'
import { PUT as activateRoute, DELETE as deleteRoute } from '../../src/routes/api/themes/[slug]/+server'
import { call, makeEvent, seedUser, withR2, fakeR2 } from '../helpers/harness'

const manifest = (over: object = {}) => JSON.stringify({ name: 'Test Theme', version: '1.0.0', slug: 'test-theme', ...over })

type Files = Record<string, string | Buffer>
function makeZip(files: Files, opts: { rename?: (n: string) => string } = {}): Uint8Array {
  const zip = new AdmZip()
  for (const [name, data] of Object.entries(files)) zip.addFile(name, Buffer.from(data))
  if (opts.rename) for (const e of zip.getEntries()) e.entryName = opts.rename(e.entryName)
  return new Uint8Array(zip.toBuffer())
}
const goodFiles = (over: Files = {}): Files => ({
  'manifest.json': manifest(),
  'templates/layout.hbs': '<html>{{{body}}}</html>',
  'templates/index.hbs': '<h1>{{site_name}}</h1>',
  'assets/style.css': 'body{color:red}',
  ...over,
})

describe('path helpers', () => {
  it.each(['default', 'my-theme', 'a', 'theme-2', '0day'])('accepts slug %s', s => expect(assertThemeSlug(s)).toBe(s))
  it.each(['', '..', '../x', 'a/b', 'A', 'with space', '-lead', 'x'.repeat(65), 'a\\b', '.hidden', undefined as any, 5 as any])('rejects slug %j', s => {
    expect(() => assertThemeSlug(s)).toThrow(ValidationError)
  })

  it.each(['a.txt', 'templates/layout.hbs', 'a/b/c.css'])('safeRelativePath accepts %s', p => expect(safeRelativePath(p)).toBe(p))
  it.each(['', '/etc/passwd', '../x', 'a/../../x', 'a/./b', './a', 'a//b', 'a/', 'a\\b', 'C:\\x', 'c:/x', 'a\0b', 'x'.repeat(256), null as any])(
    'safeRelativePath rejects %j', p => expect(safeRelativePath(p)).toBeNull())
  it('assertSafeRelativePath throws a ValidationError', () => {
    expect(() => assertSafeRelativePath('../x')).toThrow(ValidationError)
  })
})

describe('parseThemeZip', () => {
  it('parses a valid theme', () => {
    const t = parseThemeZip(makeZip(goodFiles()), 'whatever.zip')
    expect(t.slug).toBe('test-theme')
    expect(t.manifest.name).toBe('Test Theme')
    expect(t.files.map(f => f.path).sort()).toEqual(['assets/style.css', 'manifest.json', 'templates/index.hbs', 'templates/layout.hbs'])
  })

  it('unwraps a single top-level folder', () => {
    const wrapped = Object.fromEntries(Object.entries(goodFiles()).map(([k, v]) => [`my-theme/${k}`, v]))
    const t = parseThemeZip(makeZip(wrapped), 'x.zip')
    expect(t.files.map(f => f.path)).toContain('templates/layout.hbs')
  })

  it('derives the slug from the file name when the manifest has none', () => {
    const t = parseThemeZip(makeZip(goodFiles({ 'manifest.json': JSON.stringify({ name: 'N' }) })), 'Cool Theme v2.zip')
    expect(t.slug).toBe('cool-theme-v2')
  })

  it('ignores macOS junk files', () => {
    const t = parseThemeZip(makeZip(goodFiles({ '__MACOSX/._manifest.json': 'x', 'assets/.DS_Store': 'x' })), 'x.zip')
    expect(t.files.some(f => f.path.includes('MACOSX') || f.path.includes('DS_Store'))).toBe(false)
  })

  it.each([
    ['parent traversal', (n: string) => (n === 'assets/style.css' ? '../../../evil.css' : n)],
    ['deep traversal', (n: string) => (n === 'assets/style.css' ? 'assets/../../evil.css' : n)],
    ['absolute path', (n: string) => (n === 'assets/style.css' ? '/etc/cron.d/evil.css' : n)],
    ['windows traversal', (n: string) => (n === 'assets/style.css' ? '..\\..\\evil.css' : n)],
    ['drive letter', (n: string) => (n === 'assets/style.css' ? 'C:\\Windows\\evil.css' : n)],
  ])('rejects zip-slip via %s', (_n, rename) => {
    expect(() => parseThemeZip(makeZip(goodFiles(), { rename }), 'x.zip')).toThrow(/Unsafe path in archive/)
  })

  it.each(['shell.php', 'run.js', 'x.sh', 'x.exe', 'x.html', 'noextension', '.htaccess', 'x.hbs.php'])('rejects disallowed file %s', name => {
    expect(() => parseThemeZip(makeZip(goodFiles({ [`assets/${name}`]: 'x' })), 'x.zip')).toThrow(/not allowed/i)
  })

  it('requires manifest.json with a name, and templates/layout.hbs', () => {
    const { ['manifest.json']: _m, ...noManifest } = goodFiles()
    expect(() => parseThemeZip(makeZip(noManifest), 'x.zip')).toThrow(/manifest\.json not found/)
    expect(() => parseThemeZip(makeZip(goodFiles({ 'manifest.json': '{not json' })), 'x.zip')).toThrow(/Invalid manifest/)
    expect(() => parseThemeZip(makeZip(goodFiles({ 'manifest.json': '{"slug":"x"}' })), 'x.zip')).toThrow(/"name"/)
    expect(() => parseThemeZip(makeZip(goodFiles({ 'manifest.json': '[]' })), 'x.zip')).toThrow(ValidationError)
    const { ['templates/layout.hbs']: _l, ...noLayout } = goodFiles()
    expect(() => parseThemeZip(makeZip(noLayout), 'x.zip')).toThrow(/layout\.hbs is required/)
  })

  it.each(['../../x', 'UPPER', 'a/b', 'has space', '.dot'])('rejects dangerous manifest slug %j', slug => {
    expect(() => parseThemeZip(makeZip(goodFiles({ 'manifest.json': manifest({ slug }) })), 'x.zip')).toThrow(/slug/i)
  })

  it('rejects templates that do not compile', () => {
    expect(() => parseThemeZip(makeZip(goodFiles({ 'templates/index.hbs': '{{#if}}unclosed' })), 'x.zip')).toThrow(/Template syntax error in templates\/index\.hbs/)
  })

  it('rejects non-zip data, empty archives and oversized uploads', () => {
    expect(() => parseThemeZip(new TextEncoder().encode('definitely not a zip'), 'x.zip')).toThrow(/Invalid zip/)
    expect(() => parseThemeZip(new Uint8Array(new AdmZip().toBuffer()), 'x.zip')).toThrow(/empty|Invalid/i)
    expect(() => parseThemeZip(new Uint8Array(10 * 1024 * 1024 + 1), 'x.zip')).toThrow(/too large/)
  })

  it('rejects too many files', () => {
    const many = Object.fromEntries(Array.from({ length: MAX_THEME_FILES + 1 }, (_, i) => [`assets/f${i}.css`, 'x']))
    expect(() => parseThemeZip(makeZip(goodFiles(many)), 'x.zip')).toThrow(/Too many files/)
  })

  it('rejects zip bombs: highly compressible payload above the per-file cap', () => {
    const bomb = Buffer.alloc(MAX_THEME_FILE_BYTES + 1024, 0)
    const zipped = makeZip(goodFiles({ 'assets/big.css': bomb }))
    expect(zipped.byteLength).toBeLessThan(100_000) // tiny on the wire...
    expect(() => parseThemeZip(zipped, 'x.zip')).toThrow(/too large/i) // ...but refused when expanded
  })

  it('rejects when the total extracted size exceeds the cap', () => {
    const chunk = Buffer.alloc(4 * 1024 * 1024, 1)
    const files = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`assets/c${i}.css`, chunk]))
    expect(() => parseThemeZip(makeZip(goodFiles(files)), 'x.zip')).toThrow(/too large when extracted/)
  })
})

describe('theme storages', () => {
  const dirs: string[] = []
  afterAll(() => dirs.forEach(d => rmSync(d, { recursive: true, force: true })))
  const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'ws-themes-')); dirs.push(d); return d }

  it('LocalThemeStorage reads/writes inside its root and creates nested dirs', async () => {
    const root = tmp()
    const s = new LocalThemeStorage(root)
    await s.createDir('mine')
    await s.writeFile('mine', 'templates/layout.hbs', new TextEncoder().encode('hello'))
    expect(await s.readFile('mine', 'templates/layout.hbs')).toBe('hello')
    expect(await s.readFile('mine', 'nope.txt')).toBeNull()
    expect(await s.exists('mine')).toBe(true)
    expect(await s.exists('ghost')).toBe(false)
    expect(await s.listSlugs()).toEqual(['mine'])
  })

  it('LocalThemeStorage refuses traversal in slug and path (nothing is written outside the root)', async () => {
    const root = tmp()
    const outside = join(root, '..', `outside-${Date.now()}.txt`)
    const s = new LocalThemeStorage(root)
    await expect(s.writeFile('mine', '../../escape.txt', new Uint8Array([1]))).rejects.toThrow(ValidationError)
    await expect(s.writeFile('../x', 'a.txt', new Uint8Array([1]))).rejects.toThrow(ValidationError)
    await expect(s.readFile('mine', '../../../etc/passwd')).rejects.toThrow(ValidationError)
    await expect(s.createDir('..')).rejects.toThrow(ValidationError)
    expect(existsSync(outside)).toBe(false)
    expect(existsSync(resolve(root, '..', 'escape.txt'))).toBe(false)
  })

  it('LocalThemeStorage ignores stray files when listing', async () => {
    const root = tmp()
    mkdirSync(join(root, 'real'))
    writeFileSync(join(root, 'README.md'), 'x')
    expect(await new LocalThemeStorage(root).listSlugs()).toEqual(['real'])
  })

  it('R2ThemeStorage namespaces under themes/<slug>/ and validates inputs', async () => {
    const r2 = fakeR2()
    const s = new R2ThemeStorage(r2)
    await s.writeFile('mine', 'manifest.json', new TextEncoder().encode('{"name":"x"}'))
    expect([...r2.store.keys()]).toEqual(['themes/mine/manifest.json'])
    expect(await s.exists('mine')).toBe(true)
    expect(await s.readFile('mine', 'manifest.json')).toBe('{"name":"x"}')
    expect(await s.listSlugs()).toEqual(['mine'])
    await expect(s.writeFile('mine', '../../2024/01/x.png', new Uint8Array([1]))).rejects.toThrow(ValidationError)
    await expect(s.writeFile('../media', 'x.css', new Uint8Array([1]))).rejects.toThrow(ValidationError)
    expect(r2.store.size).toBe(1)
  })

  it('the default theme ships in the bundle and is read-only', async () => {
    const b = new BundledThemeStorage()
    expect(await b.listSlugs()).toEqual(['default'])
    expect(await b.exists('default')).toBe(true)
    expect(JSON.parse((await b.readFile('default', 'manifest.json'))!).name).toBeTruthy()
    expect(await b.readFile('default', 'templates/layout.hbs')).toContain('<')
    expect(await b.readFile('other', 'manifest.json')).toBeNull()
    expect(await b.readFile('default', 'missing.hbs')).toBeNull()
    await expect(b.writeFile()).rejects.toThrow(/read-only/)
  })

  it('LayeredThemeStorage: primary wins, bundled default is the fallback, writes go to primary', async () => {
    const r2 = fakeR2()
    const layered = new LayeredThemeStorage(new R2ThemeStorage(r2))
    expect(await layered.listSlugs()).toEqual(['default'])
    await layered.writeFile('mine', 'manifest.json', new TextEncoder().encode('{"name":"m"}'))
    expect((await layered.listSlugs()).sort()).toEqual(['default', 'mine'])
    expect(await layered.exists('default')).toBe(true)
    expect(await layered.readFile('default', 'manifest.json')).toContain('name')
    expect(await layered.readFile('mine', 'manifest.json')).toBe('{"name":"m"}')
  })

  it('getThemeStorage: R2-backed (with default fallback) in production, bundled-only without any storage', async () => {
    expect(await getThemeStorage(undefined).listSlugs()).toEqual(['default'])
    setThemeStorage(null)
    const r2 = fakeR2()
    const s = getThemeStorage(withR2(r2) as any)
    await s.writeFile('x', 'manifest.json', new Uint8Array([123, 125]))
    expect(r2.store.has('themes/x/manifest.json')).toBe(true)
    expect(getThemeStorage(undefined)).toBe(s) // singleton until reset
  })
})

describe('rendering the bundled default theme (what a fresh Cloudflare deploy serves)', () => {
  it('lists and renders without anything in R2 or on disk', async () => {
    const themes = await listThemes(withR2() as any)
    expect(themes.map((t: any) => t.slug)).toContain('default')
    await setActiveTheme('default', withR2() as any)
    const html = await renderPage('index', { site_name: 'Hello', sidebar_widgets: [], posts: [] }, withR2() as any)
    expect(html).toContain('<')
    expect(html).not.toBeNull()
  })
})

describe('theme API', () => {
  const zipForm = (data: Uint8Array, name = 'theme.zip') => { const fd = new FormData(); fd.set('file', new File([data as any], name)); return fd }
  const upload = (token: string | undefined, fd: FormData, r2 = fakeR2()) => call(uploadRoute, makeEvent({ method: 'POST', formData: fd, token, platform: withR2(r2) }))

  it('upload: admin-only', async () => {
    const author = await seedUser('author')
    const editor = await seedUser('editor')
    const fd = () => zipForm(makeZip(goodFiles()))
    expect((await upload(undefined, fd())).status).toBe(401)
    expect((await upload(author.token, fd())).status).toBe(403)
    expect((await upload(editor.token, fd())).status).toBe(403)
  })

  it('upload: stores validated files under the theme slug and makes it listable; duplicates are 409', async () => {
    const admin = await seedUser('admin')
    const r2 = fakeR2()
    const r = await upload(admin.token, zipForm(makeZip(goodFiles())), r2)
    expect(r.status).toBe(201)
    expect(r.json.data).toMatchObject({ slug: 'test-theme', name: 'Test Theme', version: '1.0.0' })
    expect([...r2.store.keys()].sort()).toEqual([
      'themes/test-theme/assets/style.css', 'themes/test-theme/manifest.json',
      'themes/test-theme/templates/index.hbs', 'themes/test-theme/templates/layout.hbs',
    ])
    const list = await call(listRoute, makeEvent({ token: admin.token, platform: withR2(r2) }))
    expect(list.json.data.map((t: any) => t.slug).sort()).toEqual(['default', 'test-theme'])
    expect((await upload(admin.token, zipForm(makeZip(goodFiles())), r2)).status).toBe(409)
  })

  it('upload: cannot overwrite the bundled default theme', async () => {
    const admin = await seedUser('admin')
    const r2 = fakeR2()
    const evil = makeZip(goodFiles({ 'manifest.json': manifest({ slug: 'default' }) }))
    expect((await upload(admin.token, zipForm(evil), r2)).status).toBe(409)
    expect(r2.store.size).toBe(0)
  })

  it.each([
    ['zip-slip', () => makeZip(goodFiles(), { rename: n => (n === 'assets/style.css' ? '../../../x.css' : n) })],
    ['php payload', () => makeZip(goodFiles({ 'assets/x.php': '<?php' }))],
    ['not a zip', () => new TextEncoder().encode('nope')],
    ['bad slug', () => makeZip(goodFiles({ 'manifest.json': manifest({ slug: '../../escape' }) }))],
  ])('upload: rejects %s with 400 and writes NOTHING', async (_n, build) => {
    const admin = await seedUser('admin')
    const r2 = fakeR2()
    expect((await upload(admin.token, zipForm(build()), r2)).status).toBe(400)
    expect(r2.store.size).toBe(0)
  })

  it('upload: validates the form (no file, wrong extension)', async () => {
    const admin = await seedUser('admin')
    expect((await upload(admin.token, new FormData())).status).toBe(400)
    expect((await upload(admin.token, zipForm(makeZip(goodFiles()), 'theme.tar.gz'))).status).toBe(400)
  })

  it('list/scan are admin-only too', async () => {
    const author = await seedUser('author')
    const admin = await seedUser('admin')
    expect((await call(listRoute, makeEvent())).status).toBe(401)
    expect((await call(listRoute, makeEvent({ token: author.token }))).status).toBe(403)
    expect((await call(scanRoute, makeEvent({ method: 'POST', token: author.token, body: { action: 'scan' } }))).status).toBe(403)
    expect((await call(scanRoute, makeEvent({ method: 'POST', token: admin.token, body: { action: 'scan' } }))).status).toBe(200)
    expect((await call(scanRoute, makeEvent({ method: 'POST', token: admin.token, body: { action: 'format-disk' } }))).status).toBe(400)
  })

  it('activate: admin-only, validates slug, 404 for unknown themes, persists the setting', async () => {
    const admin = await seedUser('admin')
    const author = await seedUser('author')
    const put = (token: string | undefined, slug: string) => call(activateRoute, makeEvent({ method: 'PUT', params: { slug }, token, platform: withR2() }))
    expect((await put(undefined, 'default')).status).toBe(401)
    expect((await put(author.token, 'default')).status).toBe(403)
    expect((await put(admin.token, '../../etc')).status).toBe(400)
    expect((await put(admin.token, 'ghost')).status).toBe(404)
    expect((await put(admin.token, 'default')).status).toBe(200)
    const [row] = await getDb().select().from(settings).where(eq(settings.key, 'theme'))
    expect(row.value).toBe('default')
  })

  it('activateTheme service rejects unknown themes without touching settings', async () => {
    await expect(activateTheme(getDb(), 'ghost')).rejects.toBeInstanceOf(NotFoundError)
    await getDb().delete(settings).where(eq(settings.key, 'theme'))
    await expect(activateTheme(getDb(), 'ghost')).rejects.toBeInstanceOf(NotFoundError)
    expect(await getDb().select().from(settings).where(eq(settings.key, 'theme'))).toHaveLength(0)
  })

  it('delete is still unsupported but now requires admin', async () => {
    const author = await seedUser('author')
    const admin = await seedUser('admin')
    expect((await call(deleteRoute, makeEvent({ method: 'DELETE', params: { slug: 'x' }, token: author.token }))).status).toBe(403)
    expect((await call(deleteRoute, makeEvent({ method: 'DELETE', params: { slug: 'x' }, token: admin.token }))).status).toBe(400)
  })
})
