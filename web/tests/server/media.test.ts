import { describe, it, expect } from 'vitest'
import { media } from '@wordsvelte/shared'
import { getDb } from '$lib/server/db'
import { sniffImageType, validateImageUpload, buildMediaKey, isPublicMediaKey, MAX_UPLOAD_BYTES } from '$lib/server/storage/uploads'
import { createMedia, listMedia } from '$lib/server/services/content/media.service'
import { ValidationError } from '$lib/server/core/errors'
import { GET as listRoute, POST as uploadRoute } from '../../src/routes/api/media/+server'
import { GET as getRoute, DELETE as deleteRoute } from '../../src/routes/api/media/[id]/+server'
import { GET as serveRoute } from '../../src/routes/api/media/[...path]/+server'
import { call, makeEvent, seedUser, withR2, fakeR2, PNG_BYTES } from '../helpers/harness'

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(32).fill(0)])
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0)
const GIF = new TextEncoder().encode('GIF89a\x01\x00\x01\x00')
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20])
const AVIF = new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0, 0, 0, 0])

describe('sniffImageType', () => {
  it('recognises raster formats by magic bytes', () => {
    expect(sniffImageType(JPEG)).toBe('image/jpeg')
    expect(sniffImageType(PNG_BYTES)).toBe('image/png')
    expect(sniffImageType(GIF)).toBe('image/gif')
    expect(sniffImageType(WEBP)).toBe('image/webp')
    expect(sniffImageType(AVIF)).toBe('image/avif')
  })

  it.each([
    ['html', '<!doctype html><script>alert(1)</script>'],
    ['svg', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'],
    ['svg with xml prolog', '<?xml version="1.0"?><svg/>'],
    ['php', '<?php system($_GET[1]); ?>'],
    ['js', 'alert(1)'],
    ['empty-ish', ''],
  ])('rejects %s', (_n, text) => {
    expect(sniffImageType(new TextEncoder().encode(text))).toBeNull()
  })

  it('does not accept a polyglot that merely mentions an image name', () => {
    expect(sniffImageType(new TextEncoder().encode('GIF'))).toBeNull() // too short / wrong magic
    expect(sniffImageType(new TextEncoder().encode('RIFF....WAVE'))).toBeNull() // RIFF but not WEBP
  })
})

describe('validateImageUpload / keys', () => {
  it('returns the sniffed mime and a matching extension', () => {
    expect(validateImageUpload(PNG_BYTES)).toEqual({ mimeType: 'image/png', ext: 'png' })
    expect(validateImageUpload(JPEG)).toEqual({ mimeType: 'image/jpeg', ext: 'jpg' })
  })

  it('rejects empty, oversized and non-image content', () => {
    expect(() => validateImageUpload(new Uint8Array())).toThrow(/empty/i)
    expect(() => validateImageUpload(new TextEncoder().encode('<html>'))).toThrow(ValidationError)
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1)
    big.set(PNG_BYTES)
    expect(() => validateImageUpload(big)).toThrow(/too large/i)
  })

  it('buildMediaKey is year/month/uuid.ext and unique', () => {
    const k = buildMediaKey('png', new Date('2024-03-09T10:00:00Z'))
    expect(k).toMatch(/^2024\/03\/[0-9a-f-]{36}\.png$/)
    expect(buildMediaKey('png')).not.toBe(buildMediaKey('png'))
  })

  it.each([
    ['2024/01/abc.png', true],
    ['abc.png', true],
    ['themes/default/manifest.json', false],
    ['themes/x', false],
    ['../etc/passwd', false],
    ['2024/../themes/x', false],
    ['/abs/path', false],
    ['a\\b', false],
    ['a\0b', false],
    ['', false],
    ['x'.repeat(513), false],
  ])('isPublicMediaKey(%j) = %s', (key, ok) => {
    expect(isPublicMediaKey(key)).toBe(ok)
  })
})

function uploadForm(content: Uint8Array | string, name = 'photo.png', type = 'image/png') {
  const fd = new FormData()
  fd.set('file', new File([content as any], name, { type }))
  return fd
}

describe('POST /api/media', () => {
  const up = (token: string | undefined, fd: FormData, platform = withR2()) => call(uploadRoute, makeEvent({ method: 'POST', formData: fd, token, platform }))

  it('401 anonymous', async () => {
    expect((await up(undefined, uploadForm(PNG_BYTES))).status).toBe(401)
  })

  it('stores a real image under a server-generated key with the SNIFFED type', async () => {
    const { user, token } = await seedUser('author')
    const r2 = fakeR2()
    // client lies about both name and type: it is a PNG, claims to be .exe / text/plain
    const r = await up(token, uploadForm(PNG_BYTES, '../../evil.exe', 'text/plain'), withR2(r2))
    expect(r.status).toBe(201)
    expect(r.json.data).toMatchObject({ mimeType: 'image/png', uploadedBy: user.id, size: PNG_BYTES.byteLength })
    expect(r.json.data.r2Key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/)
    const stored = r2.store.get(r.json.data.r2Key)!
    expect(stored.httpMetadata.contentType).toBe('image/png')
    expect(await getDb().select().from(media)).toHaveLength(1)
  })

  it.each([
    ['html disguised as png', new TextEncoder().encode('<html><script>alert(1)</script></html>'), 'x.png', 'image/png'],
    ['svg', new TextEncoder().encode('<svg onload=alert(1)></svg>'), 'x.svg', 'image/svg+xml'],
    ['php disguised as jpg', new TextEncoder().encode('<?php echo 1;'), 'shell.jpg', 'image/jpeg'],
    ['empty file', new Uint8Array(), 'empty.png', 'image/png'],
  ])('rejects %s with 400 and writes nothing', async (_n, content, name, type) => {
    const { token } = await seedUser('author')
    const r2 = fakeR2()
    const r = await up(token, uploadForm(content, name, type), withR2(r2))
    expect(r.status).toBe(400)
    expect(r2.store.size).toBe(0)
    expect(await getDb().select().from(media)).toHaveLength(0)
  })

  it('rejects oversized files (413-class → 400) and missing file field', async () => {
    const { token } = await seedUser('author')
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1)
    big.set(PNG_BYTES)
    expect((await up(token, uploadForm(big))).status).toBe(400)
    expect((await up(token, new FormData())).status).toBe(400)
    const fd = new FormData(); fd.set('file', 'just a string')
    expect((await up(token, fd)).status).toBe(400)
  })

  it('503 with a clear error (not a crash) when R2 is not bound', async () => {
    const { token } = await seedUser('author')
    const r = await up(token, uploadForm(PNG_BYTES), { env: { JWT_SECRET: 'test-secret-that-is-long-enough-123456' } } as any)
    expect(r.status).toBe(503)
  })

  it('rolls the stored object back if the DB insert fails', async () => {
    const { token } = await seedUser('author')
    const r2 = fakeR2()
    const { setDb, getDb: gdb } = await import('$lib/server/db')
    const real = gdb()
    // A DB whose media insert explodes, but which still authenticates users normally.
    setDb(new Proxy(real, { get: (t: any, p) => p === 'insert' ? () => { throw new Error('db down') } : t[p].bind(t) }))
    const r = await up(token, uploadForm(PNG_BYTES), withR2(r2))
    expect(r.status).toBe(500)
    expect(r2.store.size).toBe(0)
    setDb(real)
  })
})

describe('media listing, reading and deleting', () => {
  async function uploaded(owner: { token: string }) {
    const r2 = fakeR2()
    const r = await call(uploadRoute, makeEvent({ method: 'POST', formData: uploadForm(PNG_BYTES), token: owner.token, platform: withR2(r2) }))
    return { r2, record: r.json.data }
  }

  it('list/get need authentication', async () => {
    const a = await seedUser('author')
    const { record } = await uploaded(a)
    expect((await call(listRoute, makeEvent())).status).toBe(401)
    expect((await call(getRoute, makeEvent({ params: { id: String(record.id) } }))).status).toBe(401)
    expect((await call(listRoute, makeEvent({ token: a.token }))).json.data).toHaveLength(1)
    expect((await call(getRoute, makeEvent({ params: { id: String(record.id) }, token: a.token }))).json.data.id).toBe(record.id)
    expect((await call(getRoute, makeEvent({ params: { id: 'abc' }, token: a.token }))).status).toBe(400)
    expect((await call(getRoute, makeEvent({ params: { id: '9999' }, token: a.token }))).status).toBe(404)
  })

  it('authors can delete only their own uploads; editors/admins can delete any', async () => {
    const alice = await seedUser('author')
    const bob = await seedUser('author')
    const editor = await seedUser('editor')
    const { r2, record } = await uploaded(alice)
    const del = (token: string, platform = withR2(r2)) => call(deleteRoute, makeEvent({ method: 'DELETE', params: { id: String(record.id) }, token, platform }))

    expect((await del(bob.token)).status).toBe(403)
    expect(r2.store.size).toBe(1)
    expect((await call(deleteRoute, makeEvent({ method: 'DELETE', params: { id: String(record.id) }, platform: withR2(r2) }))).status).toBe(401)
    expect((await del(editor.token)).status).toBe(200)
    expect(r2.store.size).toBe(0) // object removed from storage as well
    expect((await del(editor.token)).status).toBe(404)

    const again = await uploaded(alice)
    expect((await call(deleteRoute, makeEvent({ method: 'DELETE', params: { id: String(again.record.id) }, token: alice.token, platform: withR2(again.r2) }))).status).toBe(200)
  })

  it('listMedia returns newest first', async () => {
    const { user } = await seedUser('author')
    for (const n of ['a', 'b', 'c']) await createMedia(getDb(), { r2Key: n, originalName: n, mimeType: 'image/png', size: 1, uploadedBy: user.id })
    expect((await listMedia(getDb())).map((m: any) => m.r2Key)).toEqual(['c', 'b', 'a'])
  })

  it('createMedia truncates absurd file names', async () => {
    const { user } = await seedUser('author')
    const m = await createMedia(getDb(), { r2Key: 'k', originalName: 'x'.repeat(1000), mimeType: 'image/png', size: 1, uploadedBy: user.id })
    expect(m.originalName).toHaveLength(255)
  })
})

describe('GET /api/media/[...path] (public file serving)', () => {
  const serve = (path: string, r2 = fakeR2()) => call(serveRoute, { params: { path }, platform: withR2(r2) })

  it('serves images inline with hardening headers and long cache', async () => {
    const r2 = fakeR2()
    await r2.put('2024/01/a.png', PNG_BYTES, { httpMetadata: { contentType: 'image/png' } })
    const r = await serve('2024/01/a.png', r2)
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('image/png')
    expect(r.headers.get('Content-Disposition')).toBe('inline')
    expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(r.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
    expect(r.headers.get('Cache-Control')).toContain('immutable')
  })

  it.each(['text/html', 'image/svg+xml', 'application/javascript', 'text/plain', undefined])('forces download for non-raster type %s (old uploads/imports)', async type => {
    const r2 = fakeR2()
    await r2.put('2020/01/old.bin', new TextEncoder().encode('<script>alert(1)</script>'), { httpMetadata: type ? { contentType: type } : undefined })
    const r = await serve('2020/01/old.bin', r2)
    expect(r.status).toBe(200)
    expect(r.headers.get('Content-Type')).toBe('application/octet-stream')
    expect(r.headers.get('Content-Disposition')).toBe('attachment')
  })

  it('404s for the themes/ namespace, traversal, missing files and when R2 is absent', async () => {
    const r2 = fakeR2()
    await r2.put('themes/default/templates/layout.hbs', new TextEncoder().encode('SECRET TEMPLATE'))
    expect((await serve('themes/default/templates/layout.hbs', r2)).status).toBe(404)
    expect((await serve('../themes/x', r2)).status).toBe(404)
    expect((await serve('nope.png', r2)).status).toBe(404)
    expect((await call(serveRoute, { params: { path: 'a.png' }, platform: { env: {} } })).status).toBe(404)
    expect((await call(serveRoute, { params: {}, platform: withR2(r2) })).status).toBe(404)
  })
})
