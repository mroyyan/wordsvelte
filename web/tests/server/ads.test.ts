import { describe, it, expect } from 'vitest'
import { getDb } from '$lib/server/db'
import { createAd, updateAd, deleteAd, getAd, listAds, getRunningAds, followAd } from '$lib/server/services/site/ads.service'
import { getSiteChrome } from '$lib/server/services/content/public-site.service'
import { updateSettings } from '$lib/server/services/site/settings.service'
import { NotFoundError, ValidationError } from '$lib/server/core/errors'
import { splitAfterParagraph, deviceClass } from '$lib/shared/ads'
import { GET as clickRoute } from '../../src/routes/ads/[id]/click/+server'
import { GET as adsTxt } from '../../src/routes/ads.txt/+server'
import * as adsApi from '../../src/routes/api/ads/+server'
import * as adApi from '../../src/routes/api/ads/[id]/+server'
import { call, makeEvent, seedUser } from '../helpers/harness'

const HOUR = 3_600_000
const at = (ms: number) => new Date(Date.now() + ms).toISOString()
const banner = (over: Record<string, unknown> = {}) => ({
  name: 'Sponsor', placement: 'sidebar-top', type: 'banner', imageUrl: 'https://cdn.example.com/a.png', linkUrl: 'https://advertiser.example/x', altText: 'Sponsor', ...over,
})
const code = (over: Record<string, unknown> = {}) => ({ name: 'AdSense', placement: 'footer', type: 'code', code: '<script async src="https://ads.example/x.js"></script><ins class="ad"></ins>', ...over })
const bad = (input: Record<string, unknown>, pattern: RegExp) => expect(createAd(getDb(), input)).rejects.toThrow(pattern)

describe('creating ads', () => {
  it('stores a banner and a code ad with sensible defaults', async () => {
    const b = await createAd(getDb(), banner())
    expect(b).toMatchObject({ type: 'banner', devices: 'all', status: 'active', sortOrder: 0, clicks: 0, code: null, startsAt: null, endsAt: null })
    const c = await createAd(getDb(), code())
    expect(c).toMatchObject({ type: 'code', imageUrl: null, linkUrl: null })
    expect(c.code).toContain('<script')
    expect(await listAds(getDb())).toHaveLength(2)
  })

  it('validates every field', async () => {
    await bad(banner({ name: '  ' }), /Name is required/)
    await bad(banner({ name: 'x'.repeat(101) }), /at most 100/)
    await bad(banner({ placement: 'moon' }), /Placement must be one of/)
    await bad(banner({ type: 'video' }), /Type must be one of/)
    await bad(banner({ devices: 'tv' }), /Devices must be one of/)
    await bad(banner({ status: 'deleted' }), /Status must be one of/)
    await bad(banner({ sortOrder: -1 }), /Order must be/)
    await bad(banner({ sortOrder: 1.5 }), /Order must be/)
    await bad(banner({ imageUrl: '' }), /needs an image/)
    await bad(banner({ linkUrl: '' }), /needs a link/)
    await bad(banner({ linkUrl: 'javascript:alert(1)' }), /full URL/)
    await bad(banner({ linkUrl: '/relative' }), /full URL/)
    await bad(banner({ imageUrl: 'data:image/png;base64,xx' }), /Image must be/)
    await bad(banner({ imageUrl: '//evil.example/a.png' }), /Image must be/)
    await bad(banner({ altText: 'x'.repeat(151) }), /Alt text/)
    await bad(code({ code: '   ' }), /Paste the ad code/)
    await bad(code({ code: 'x'.repeat(20_001) }), /too long/)
    await bad(banner({ startsAt: 'next week' }), /Start date is not a valid date/)
    await bad(banner({ startsAt: at(2 * HOUR), endsAt: at(HOUR) }), /end date must be after/)
    expect(await listAds(getDb())).toHaveLength(0) // nothing half-created
  })

  it('accepts a same-site image path and normalises dates to ISO', async () => {
    const ad = await createAd(getDb(), banner({ imageUrl: '/api/media/banner.png', startsAt: '2030-01-01T09:00:00+07:00' }))
    expect(ad.imageUrl).toBe('/api/media/banner.png')
    expect(ad.startsAt).toBe('2030-01-01T02:00:00.000Z')
  })

  it('ignores fields that belong to the other type', async () => {
    const ad = await createAd(getDb(), { ...banner(), code: '<script>evil()</script>' })
    expect(ad.code).toBeNull()
    const c = await createAd(getDb(), { ...code(), imageUrl: 'https://x.example/a.png', linkUrl: 'https://x.example' })
    expect(c.imageUrl).toBeNull()
    expect(c.linkUrl).toBeNull()
  })
})

describe('updating and deleting', () => {
  it('merges a partial change and re-validates the result', async () => {
    const ad = await createAd(getDb(), banner())
    const u = await updateAd(getDb(), ad.id, { name: 'Renamed', status: 'paused' })
    expect(u).toMatchObject({ name: 'Renamed', status: 'paused', linkUrl: ad.linkUrl, placement: 'sidebar-top' })
    await expect(updateAd(getDb(), ad.id, { linkUrl: 'ftp://x' })).rejects.toBeInstanceOf(ValidationError)
    expect((await getAd(getDb(), ad.id)).linkUrl).toBe(ad.linkUrl) // untouched by the failed update
  })

  it('can switch type and clear a date', async () => {
    const ad = await createAd(getDb(), banner({ startsAt: at(HOUR) }))
    const u = await updateAd(getDb(), ad.id, { type: 'code', code: '<div>x</div>', startsAt: null })
    expect(u).toMatchObject({ type: 'code', imageUrl: null, linkUrl: null, startsAt: null })
  })

  it('reports unknown ads and deletes', async () => {
    await expect(getAd(getDb(), 999)).rejects.toBeInstanceOf(NotFoundError)
    await expect(updateAd(getDb(), 999, { name: 'x' })).rejects.toBeInstanceOf(NotFoundError)
    await expect(deleteAd(getDb(), 999)).rejects.toBeInstanceOf(NotFoundError)
    const ad = await createAd(getDb(), banner())
    await deleteAd(getDb(), ad.id)
    expect(await listAds(getDb())).toHaveLength(0)
  })
})

describe('which ads run', () => {
  it('groups running ads by placement in display order, honouring status and the run window', async () => {
    const second = await createAd(getDb(), banner({ name: 'B', sortOrder: 5 }))
    const first = await createAd(getDb(), banner({ name: 'A', sortOrder: 1 }))
    await createAd(getDb(), banner({ name: 'paused', status: 'paused' }))
    await createAd(getDb(), banner({ name: 'future', startsAt: at(HOUR) }))
    await createAd(getDb(), banner({ name: 'over', startsAt: at(-3 * HOUR), endsAt: at(-HOUR) }))
    const open = await createAd(getDb(), banner({ name: 'open window', placement: 'header', startsAt: at(-HOUR), endsAt: at(HOUR) }))

    const running = await getRunningAds(getDb())
    expect(running['sidebar-top']!.map(a => a.id)).toEqual([first.id, second.id])
    expect(running.header!.map(a => a.id)).toEqual([open.id])
    expect(Object.keys(running).sort()).toEqual(['header', 'sidebar-top'])
  })

  it('uses the clock it is given', async () => {
    await createAd(getDb(), banner({ startsAt: at(2 * HOUR) }))
    expect((await getRunningAds(getDb(), new Date()))['sidebar-top']).toBeUndefined()
    expect((await getRunningAds(getDb(), new Date(Date.now() + 3 * HOUR)))['sidebar-top']).toHaveLength(1)
  })

  it('never exposes a banner destination or an image-only field of a code ad', async () => {
    await createAd(getDb(), banner())
    await createAd(getDb(), code())
    const running = await getRunningAds(getDb())
    const b = running['sidebar-top']![0]
    expect(b.href).toMatch(/^\/ads\/\d+\/click$/)
    expect(JSON.stringify(running)).not.toContain('advertiser.example')
    const c = running.footer![0]
    expect(c).toMatchObject({ imageUrl: null, href: null })
    expect(c.code).toContain('ins')
  })
})

describe('the public chrome', () => {
  const chrome = (pathname = '/') => getSiteChrome(getDb(), undefined, 'https://news.example.com', pathname)

  it('carries the running ads, except in the admin and when ads are switched off', async () => {
    await createAd(getDb(), banner())
    expect((await chrome()).ads['sidebar-top']).toHaveLength(1)
    expect((await chrome('/admin/posts')).ads).toEqual({})
    expect((await chrome('/admin')).ads).toEqual({})

    await updateSettings(getDb(), { ads_enabled: 'false' })
    expect((await chrome()).ads).toEqual({})
  })
})

describe('banner clicks', () => {
  // SvelteKit's redirect() and error() are thrown, not returned
  async function click(id: string, ip = '9.9.9.9'): Promise<{ status: number; location?: string }> {
    try {
      await (clickRoute as any)(makeEvent({ params: { id }, ip, path: `/ads/${id}/click` }))
      return { status: 200 }
    } catch (e: any) {
      return { status: e.status, location: e.location }
    }
  }

  it('counts and redirects to the stored destination', async () => {
    const ad = await createAd(getDb(), banner())
    const r = await click(String(ad.id))
    expect(r.status).toBe(302)
    expect(r.location).toBe('https://advertiser.example/x')
    expect((await getAd(getDb(), ad.id)).clicks).toBe(1)
  })

  it('does not follow paused, finished, not-yet-started, code or unknown ads', async () => {
    const paused = await createAd(getDb(), banner({ status: 'paused' }))
    const over = await createAd(getDb(), banner({ startsAt: at(-3 * HOUR), endsAt: at(-HOUR) }))
    const later = await createAd(getDb(), banner({ startsAt: at(HOUR) }))
    const snippet = await createAd(getDb(), code())
    for (const id of [paused.id, over.id, later.id, snippet.id, 4242]) expect((await click(String(id))).status).toBe(404)
    for (const id of ['abc', '0', '-1', '1.5']) expect((await click(id)).status).toBe(404)
    await expect(followAd(getDb(), paused.id)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('keeps redirecting but stops counting when one address clicks too fast', async () => {
    const ad = await createAd(getDb(), banner())
    for (let i = 0; i < 40; i++) expect((await click(String(ad.id), '5.5.5.5')).status).toBe(302)
    expect((await getAd(getDb(), ad.id)).clicks).toBe(30)
    expect((await click(String(ad.id), '6.6.6.6')).status).toBe(302)
    expect((await getAd(getDb(), ad.id)).clicks).toBe(31)
  })
})

describe('ads.txt', () => {
  it('serves the text from Settings, and 404 while it is empty', async () => {
    const empty = await adsTxt(makeEvent({ path: '/ads.txt' }))
    expect(empty.status).toBe(404)
    await updateSettings(getDb(), { ads_txt: 'google.com, pub-1234, DIRECT, f08c47fec0942fa0\n' })
    const res = await adsTxt(makeEvent({ path: '/ads.txt' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/text\/plain/)
    expect(await res.text()).toBe('google.com, pub-1234, DIRECT, f08c47fec0942fa0\n')
  })

  it('limits the setting to something sensible', async () => {
    await expect(updateSettings(getDb(), { ads_txt: 'x'.repeat(5001) })).rejects.toBeInstanceOf(ValidationError)
    await expect(updateSettings(getDb(), { ads_enabled: 'maybe' })).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('the admin API', () => {
  it('is for administrators only, and returns the ad code to them', async () => {
    const admin = await seedUser('admin')
    const editor = await seedUser('editor')
    const anon = await call(adsApi.GET, makeEvent({}))
    expect(anon.status).toBe(401)
    expect((await call(adsApi.GET, makeEvent({ token: editor.token }))).status).toBe(403)
    expect((await call(adsApi.POST, makeEvent({ method: 'POST', token: editor.token, body: code() }))).status).toBe(403)

    const made = await call(adsApi.POST, makeEvent({ method: 'POST', token: admin.token, body: code() }))
    expect(made.status).toBe(201)
    const id = String(made.json.data.id)
    expect((await call(adApi.GET, makeEvent({ token: admin.token, params: { id } }))).json.data.code).toContain('<script')
    expect((await call(adApi.PATCH, makeEvent({ method: 'PATCH', token: editor.token, params: { id }, body: { name: 'x' } }))).status).toBe(403)
    expect((await call(adApi.PATCH, makeEvent({ method: 'PATCH', token: admin.token, params: { id }, body: { name: 'Renamed' } }))).json.data.name).toBe('Renamed')
    expect((await call(adApi.PATCH, makeEvent({ method: 'PATCH', token: admin.token, params: { id }, body: { code: '' } }))).status).toBe(400)
    expect((await call(adApi.GET, makeEvent({ token: admin.token, params: { id: 'abc' } }))).status).toBe(400)
    expect((await call(adApi.DELETE, makeEvent({ method: 'DELETE', token: editor.token, params: { id } }))).status).toBe(403)
    expect((await call(adApi.DELETE, makeEvent({ method: 'DELETE', token: admin.token, params: { id } }))).status).toBe(200)
    expect((await call(adApi.GET, makeEvent({ token: admin.token, params: { id } }))).status).toBe(404)
  })
})

describe('helpers for the page', () => {
  it('splits an article after its n-th paragraph, or not at all when it is too short', () => {
    const html = '<p>One</p>\n<p>Two</p><h2>Head</h2><p>Three</p>'
    expect(splitAfterParagraph(html, 2)).toEqual({ head: '<p>One</p>\n<p>Two</p>', tail: '<h2>Head</h2><p>Three</p>' })
    expect(splitAfterParagraph(html.toUpperCase(), 1)!.head).toBe('<P>ONE</P>')
    expect(splitAfterParagraph('<p>One</p><p>Two</p>', 2)).toBeNull() // nothing left after the cut: the ad would just be at the end
    expect(splitAfterParagraph('<p>One</p><p> </p>', 1)).toBeNull()
    expect(splitAfterParagraph('<div>no paragraphs</div>', 2)).toBeNull()
  })

  it('hides ads from the devices they are not meant for', () => {
    expect(deviceClass('all')).toBe('')
    expect(deviceClass('desktop')).toBe('hidden md:block')
    expect(deviceClass('mobile')).toBe('md:hidden')
  })
})
