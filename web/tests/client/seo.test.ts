import { describe, it, expect } from 'vitest'
import {
  stripHtml, snippet, absoluteUrl, siteOrigin, canonicalUrl, pageTitle, buildHead,
  websiteLd, organizationLd, breadcrumbLd, newsArticleLd, webPageLd, jsonLdScript,
} from '../../src/lib/shared/seo'

const ORIGIN = 'https://news.example.com'

describe('stripHtml / snippet', () => {
  it('removes tags, script/style bodies and decodes common entities', () => {
    expect(stripHtml('<p>Halo &amp; <b>dunia</b></p><script>alert(1)</script><style>p{}</style>&nbsp;ok')).toBe('Halo & dunia ok')
    expect(stripHtml('')).toBe('')
    expect(stripHtml(null)).toBe('')
    expect(stripHtml('a   \n\t b')).toBe('a b')
  })

  it('keeps short text as is and cuts long text at a word boundary with an ellipsis', () => {
    expect(snippet('<p>Pendek saja</p>')).toBe('Pendek saja')
    const long = 'kata '.repeat(100)
    const out = snippet(long, 50)
    expect(out.length).toBeLessThanOrEqual(50)
    expect(out.endsWith('…')).toBe(true)
    expect(out.slice(0, -1).split(' ').every(w => w === 'kata')).toBe(true) // every word before the ellipsis is whole
    expect(snippet('x'.repeat(300), 40)).toHaveLength(40) // unbroken text falls back to a hard cut
  })

  it('does not leave dangling punctuation before the ellipsis', () => {
    expect(snippet('Satu dua tiga, empat lima enam tujuh delapan sembilan sepuluh', 30)).not.toMatch(/[,.;:]…$/)
  })
})

describe('urls', () => {
  it('absoluteUrl accepts web and site-relative URLs only', () => {
    expect(absoluteUrl(ORIGIN, 'https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(absoluteUrl(ORIGIN, '/api/media/2026/01/a.png')).toBe(`${ORIGIN}/api/media/2026/01/a.png`)
    expect(absoluteUrl(`${ORIGIN}/`, '/x')).toBe(`${ORIGIN}/x`)
    for (const bad of ['//evil.example/x.png', 'javascript:alert(1)', 'data:text/html,x', 'relative/path.png', '', null, undefined]) {
      expect(absoluteUrl(ORIGIN, bad as any)).toBeNull()
    }
  })

  it('siteOrigin keeps only the origin of a valid http(s) Site URL, otherwise the fallback', () => {
    expect(siteOrigin('https://news.example.com/', 'http://localhost')).toBe('https://news.example.com')
    expect(siteOrigin('https://news.example.com/some/path?x=1#y', 'http://localhost')).toBe('https://news.example.com')
    expect(siteOrigin('http://localhost:5173', 'x')).toBe('http://localhost:5173')
    for (const bad of ['', undefined, null, 'news.example.com', 'javascript:alert(1)', 'ftp://x.test']) expect(siteOrigin(bad as any, 'https://fallback.test/')).toBe('https://fallback.test')
  })

  it('canonicalUrl drops trailing slashes and query noise, keeping only ?page=N for N > 1', () => {
    expect(canonicalUrl(ORIGIN, '/')).toBe(`${ORIGIN}/`)
    expect(canonicalUrl(`${ORIGIN}/`, '/')).toBe(`${ORIGIN}/`)
    expect(canonicalUrl(ORIGIN, '/berita-satu')).toBe(`${ORIGIN}/berita-satu`)
    expect(canonicalUrl(ORIGIN, '/berita-satu/')).toBe(`${ORIGIN}/berita-satu`)
    expect(canonicalUrl(ORIGIN, '/kategori/nasional', 1)).toBe(`${ORIGIN}/kategori/nasional`)
    expect(canonicalUrl(ORIGIN, '/kategori/nasional', 3)).toBe(`${ORIGIN}/kategori/nasional?page=3`)
    expect(canonicalUrl(ORIGIN, '/', 2)).toBe(`${ORIGIN}/?page=2`)
  })

  it('pageTitle appends the site name once', () => {
    expect(pageTitle('Banjir Kediri', 'Kubus News')).toBe('Banjir Kediri | Kubus News')
    expect(pageTitle('Tentang Kubus News', 'Kubus News')).toBe('Tentang Kubus News')
    expect(pageTitle('', 'Kubus News')).toBe('Kubus News')
    expect(pageTitle(null, 'Kubus News')).toBe('Kubus News')
  })
})

describe('buildHead', () => {
  const base = { siteName: 'Kubus News', siteUrl: ORIGIN, pathname: '/banjir-kediri', title: 'Banjir | Kubus News', language: 'id' }

  it('produces canonical, OG and Twitter data for an article', () => {
    const h = buildHead({
      ...base, type: 'article', description: '<p>Banjir melanda sejumlah desa.</p>', image: '/api/media/2026/10/a.jpg',
      publishedAt: '2026-10-05T09:00:00.000Z', modifiedAt: '2026-10-06 10:30:00', authorName: 'Budi', section: 'Nasional', tags: ['banjir', 'kediri'],
    })
    expect(h.canonical).toBe(`${ORIGIN}/banjir-kediri`)
    expect(h.description).toBe('Banjir melanda sejumlah desa.')
    expect(h.og).toMatchObject({ 'og:type': 'article', 'og:title': 'Banjir | Kubus News', 'og:url': `${ORIGIN}/banjir-kediri`, 'og:image': `${ORIGIN}/api/media/2026/10/a.jpg`, 'og:locale': 'id_ID', 'og:site_name': 'Kubus News' })
    expect(h.twitter['twitter:card']).toBe('summary_large_image')
    expect(h.article).toEqual({ published_time: '2026-10-05T09:00:00.000Z', modified_time: '2026-10-06T10:30:00.000Z', author: 'Budi', section: 'Nasional', tag: ['banjir', 'kediri'] })
    expect(h.robots).toBe('index, follow, max-image-preview:large')
  })

  it('falls back to the site defaults for description and image, and to a small card without an image', () => {
    const withDefaults = buildHead({ ...base, defaults: { description: 'Portal berita Kediri', image: 'https://cdn.example.com/og.jpg' } })
    expect(withDefaults.description).toBe('Portal berita Kediri')
    expect(withDefaults.og['og:image']).toBe('https://cdn.example.com/og.jpg')
    const bare = buildHead(base)
    expect(bare.og['og:image']).toBeUndefined()
    expect(bare.twitter['twitter:card']).toBe('summary')
    expect(bare.description).toBe('')
    expect(bare.og['og:description']).toBeUndefined()
  })

  it('ignores unsafe image values instead of emitting them', () => {
    const h = buildHead({ ...base, image: 'javascript:alert(1)', defaults: { image: '//evil.example/x.png' } })
    expect(h.og['og:image']).toBeUndefined()
  })

  it('robots: page-level noindex keeps links followable, a hidden site blocks everything', () => {
    expect(buildHead({ ...base, noindex: true }).robots).toBe('noindex, follow')
    expect(buildHead({ ...base, hideSite: true }).robots).toBe('noindex, nofollow')
    expect(buildHead({ ...base, hideSite: true, noindex: true }).robots).toBe('noindex, nofollow')
  })

  it('maps languages to OG locales with an Indonesian default', () => {
    expect(buildHead({ ...base, language: 'en' }).og['og:locale']).toBe('en_US')
    expect(buildHead({ ...base, language: 'zz' }).og['og:locale']).toBe('id_ID')
  })

  it('paginated listings get a distinct canonical', () => {
    expect(buildHead({ ...base, pathname: '/', pageNumber: 2 }).canonical).toBe(`${ORIGIN}/?page=2`)
  })

  it('ignores unparsable dates', () => {
    const h = buildHead({ ...base, type: 'article', publishedAt: 'garbage' })
    expect(h.article.published_time).toBeUndefined()
  })
})

describe('JSON-LD builders', () => {
  it('NewsArticle carries what Google News needs and truncates long headlines to 110 chars', () => {
    const ld: any = newsArticleLd({
      url: `${ORIGIN}/a`, headline: 'x'.repeat(200), description: 'd', images: [`${ORIGIN}/i.jpg`], published: '2026-10-05T09:00:00.000Z', modified: null,
      authorName: 'Budi', publisherName: 'Kubus News', publisherLogo: `${ORIGIN}/logo.png`, section: 'Nasional', keywords: ['a', 'b'], language: 'id',
    })
    expect(ld['@type']).toBe('NewsArticle')
    expect(ld.headline.length).toBeLessThanOrEqual(110)
    expect(ld.datePublished).toBe('2026-10-05T09:00:00.000Z')
    expect(ld.dateModified).toBe(ld.datePublished) // falls back to the publish date
    expect(ld.author).toEqual({ '@type': 'Person', name: 'Budi' })
    expect(ld.publisher).toMatchObject({ '@type': 'Organization', name: 'Kubus News', logo: { url: `${ORIGIN}/logo.png` } })
    expect(ld.mainEntityOfPage['@id']).toBe(`${ORIGIN}/a`)
    expect(ld.keywords).toBe('a, b')
  })

  it('NewsArticle without an author credits the publisher; optional fields are omitted, not null', () => {
    const ld: any = newsArticleLd({ url: `${ORIGIN}/a`, headline: 'T', publisherName: 'Kubus News' })
    expect(ld.author).toEqual({ '@type': 'Organization', name: 'Kubus News' })
    for (const k of ['image', 'datePublished', 'dateModified', 'articleSection', 'keywords', 'description']) expect(ld).not.toHaveProperty(k)
  })

  it('BreadcrumbList numbers items from 1', () => {
    const ld: any = breadcrumbLd([{ name: 'Beranda', url: `${ORIGIN}/` }, { name: 'Nasional', url: `${ORIGIN}/kategori/nasional` }])
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2])
    expect(ld.itemListElement[1]).toMatchObject({ name: 'Nasional', item: `${ORIGIN}/kategori/nasional` })
  })

  it('WebSite exposes a sitelinks search box, Organization lists social profiles', () => {
    const w: any = websiteLd({ name: 'Kubus News', url: ORIGIN, searchUrl: `${ORIGIN}/search` })
    expect(w.url).toBe(`${ORIGIN}/`)
    expect(w.potentialAction.target.urlTemplate).toBe(`${ORIGIN}/search?q={search_term_string}`)
    const o: any = organizationLd({ name: 'Kubus News', url: ORIGIN, sameAs: ['https://facebook.com/kubus'] })
    expect(o['@type']).toBe('NewsMediaOrganization')
    expect(o.sameAs).toEqual(['https://facebook.com/kubus'])
    expect(organizationLd({ name: 'X', url: ORIGIN })).not.toHaveProperty('sameAs')
  })

  it('WebPage', () => {
    expect(webPageLd({ url: `${ORIGIN}/tentang`, name: 'Tentang', modified: '2026-10-05 09:00:00' })).toMatchObject({ '@type': 'WebPage', dateModified: '2026-10-05T09:00:00.000Z' })
  })
})

describe('jsonLdScript (XSS safety)', () => {
  it('cannot be broken out of by hostile text in titles or descriptions', () => {
    const hostile = '</script><script>alert(1)</script><img src=x onerror=alert(2)>'
    const html = jsonLdScript(newsArticleLd({ url: `${ORIGIN}/a`, headline: hostile, description: hostile, publisherName: 'Site', authorName: hostile }))
    // exactly one opening and one closing script tag: nothing inside can terminate it
    expect((html.match(/<script/g) || []).length).toBe(1)
    expect((html.match(/<\/script>/g) || []).length).toBe(1)
    expect(html.slice(0, -'</script>'.length)).not.toMatch(/<(?!script type="application\/ld\+json">)/)
    expect(html).not.toContain('<img')
  })

  it('round-trips: the escaped JSON parses back to the original data', () => {
    const data = { a: '<b>&</b>', n: 'baris baru' }
    const inner = jsonLdScript(data).replace(/^<script type="application\/ld\+json">/, '').replace(/<\/script>$/, '')
    expect(JSON.parse(inner)).toEqual(data)
    expect(inner).not.toContain(' ')
  })
})
