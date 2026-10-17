/**
 * Pure SEO helpers: description snippets, absolute/canonical URLs, <head> metadata and JSON-LD (schema.org) builders.
 * No framework or server imports, so the same code runs during SSR, in the browser and in tests.
 */

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' }

/** Reduce an HTML fragment to plain text (tags and script/style bodies removed, entities decoded, whitespace collapsed). */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, m => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

/** A search-result sized snippet: cut at a word boundary, with an ellipsis only when something was dropped. */
export function snippet(text: string | null | undefined, max = 160): string {
  const plain = stripHtml(text)
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:!?-]+$/, '') + '…'
}

/** Make `value` absolute against the site origin; returns null for anything that is not a safe web/relative URL. */
export function absoluteUrl(base: string, value: string | null | undefined): string | null {
  if (!value) return null
  const v = value.trim()
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('//')) return null // protocol-relative: ambiguous, never emit
  if (v.startsWith('/')) return base.replace(/\/+$/, '') + v
  return null
}

/** The origin of a configured Site URL (path, query and trailing slash dropped); `fallback` when unset or invalid. */
export function siteOrigin(configured: string | null | undefined, fallback: string): string {
  if (configured) {
    try {
      const u = new URL(configured.trim())
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin
    } catch { /* fall through */ }
  }
  return fallback.replace(/\/+$/, '')
}

/** Canonical URL: no trailing slash (except the root), no tracking parameters; only ?page=N for N > 1 survives. */
export function canonicalUrl(origin: string, pathname: string, pageNumber?: number): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const url = origin.replace(/\/+$/, '') + (path || '/')
  return pageNumber && pageNumber > 1 ? `${url}?page=${pageNumber}` : url
}

export const pageTitle = (title: string | null | undefined, siteName: string) =>
  !title || title === siteName ? siteName : title.toLowerCase().includes(siteName.toLowerCase()) ? title : `${title} | ${siteName}`

const OG_LOCALES: Record<string, string> = { id: 'id_ID', en: 'en_US' }

export interface HeadInput {
  siteName: string
  /** Site origin, e.g. https://news.example.com */
  siteUrl: string
  pathname: string
  pageNumber?: number
  /** Already includes the site name when wanted (use pageTitle()). */
  title: string
  description?: string | null
  image?: string | null
  type?: 'website' | 'article'
  language?: string
  /** Page-level noindex (e.g. search results). */
  noindex?: boolean
  /** Site-wide switch from Settings ("Allow search engines" off). */
  hideSite?: boolean
  defaults?: { description?: string | null; image?: string | null }
  publishedAt?: string | null
  modifiedAt?: string | null
  authorName?: string | null
  section?: string | null
  tags?: string[]
  jsonLd?: object[]
}

export interface HeadData {
  title: string
  description: string
  canonical: string
  robots: string
  og: Record<string, string>
  twitter: Record<string, string>
  article: { published_time?: string; modified_time?: string; author?: string; section?: string; tag: string[] }
  jsonLd: object[]
}

const iso = (v: string | null | undefined): string | undefined => {
  if (!v) return undefined
  let s = v.trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) s = s.replace(' ', 'T') + (s.length === 16 ? ':00Z' : 'Z')
  else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) s += 'Z'
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export function buildHead(i: HeadInput): HeadData {
  const description = snippet(i.description || i.defaults?.description, 160)
  const canonical = canonicalUrl(i.siteUrl, i.pathname, i.pageNumber)
  const image = absoluteUrl(i.siteUrl, i.image) ?? absoluteUrl(i.siteUrl, i.defaults?.image)
  const hidden = i.hideSite || i.noindex
  const type = i.type ?? 'website'

  const og: Record<string, string> = {
    'og:site_name': i.siteName, 'og:type': type, 'og:title': i.title, 'og:url': canonical,
    'og:locale': OG_LOCALES[i.language ?? 'id'] ?? 'id_ID',
  }
  if (description) og['og:description'] = description
  if (image) og['og:image'] = image

  const twitter: Record<string, string> = { 'twitter:card': image ? 'summary_large_image' : 'summary', 'twitter:title': i.title }
  if (description) twitter['twitter:description'] = description
  if (image) twitter['twitter:image'] = image

  return {
    title: i.title,
    description,
    canonical,
    // Even for hidden pages let crawlers follow links, except when the whole site is hidden.
    robots: i.hideSite ? 'noindex, nofollow' : hidden ? 'noindex, follow' : 'index, follow, max-image-preview:large',
    og,
    twitter,
    article: type === 'article'
      ? { published_time: iso(i.publishedAt), modified_time: iso(i.modifiedAt) ?? iso(i.publishedAt), author: i.authorName ?? undefined, section: i.section ?? undefined, tag: i.tags ?? [] }
      : { tag: [] },
    jsonLd: i.jsonLd ?? [],
  }
}

// ---------- JSON-LD (schema.org) ----------

const CONTEXT = 'https://schema.org'

export function websiteLd(o: { name: string; url: string; description?: string; searchUrl?: string; language?: string }) {
  const url = o.url.replace(/\/+$/, '') + '/'
  return {
    '@context': CONTEXT, '@type': 'WebSite', name: o.name, url,
    ...(o.description ? { description: o.description } : {}),
    ...(o.language ? { inLanguage: o.language } : {}),
    ...(o.searchUrl ? { potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${o.searchUrl}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } } : {}),
  }
}

export function organizationLd(o: { name: string; url: string; logo?: string | null; sameAs?: string[] }) {
  return {
    '@context': CONTEXT, '@type': 'NewsMediaOrganization', name: o.name, url: o.url.replace(/\/+$/, '') + '/',
    ...(o.logo ? { logo: { '@type': 'ImageObject', url: o.logo } } : {}),
    ...(o.sameAs?.length ? { sameAs: o.sameAs } : {}),
  }
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@context': CONTEXT, '@type': 'BreadcrumbList',
    itemListElement: items.map((it, idx) => ({ '@type': 'ListItem', position: idx + 1, name: it.name, item: it.url })),
  }
}

export function newsArticleLd(o: {
  url: string; headline: string; description?: string; images?: string[]; published?: string | null; modified?: string | null
  authorName?: string | null; publisherName: string; publisherLogo?: string | null; section?: string | null; keywords?: string[]; language?: string
}) {
  const published = iso(o.published)
  const modified = iso(o.modified) ?? published
  return {
    '@context': CONTEXT, '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': o.url },
    headline: o.headline.length > 110 ? o.headline.slice(0, 109).trimEnd() + '…' : o.headline,
    ...(o.description ? { description: o.description } : {}),
    ...(o.images?.length ? { image: o.images } : {}),
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    author: o.authorName ? { '@type': 'Person', name: o.authorName } : { '@type': 'Organization', name: o.publisherName },
    publisher: { '@type': 'Organization', name: o.publisherName, ...(o.publisherLogo ? { logo: { '@type': 'ImageObject', url: o.publisherLogo } } : {}) },
    ...(o.section ? { articleSection: o.section } : {}),
    ...(o.keywords?.length ? { keywords: o.keywords.join(', ') } : {}),
    ...(o.language ? { inLanguage: o.language } : {}),
  }
}

export function webPageLd(o: { url: string; name: string; description?: string; modified?: string | null; language?: string }) {
  const modified = iso(o.modified)
  return {
    '@context': CONTEXT, '@type': 'WebPage', url: o.url, name: o.name,
    ...(o.description ? { description: o.description } : {}),
    ...(modified ? { dateModified: modified } : {}),
    ...(o.language ? { inLanguage: o.language } : {}),
  }
}

/**
 * Serialise JSON-LD for an inline <script>. `<`, `>` and `&` are escaped so user-controlled text (a post title such as
 * "</script><script>alert(1)") can never close the tag; U+2028/2029 are escaped because they break JS parsers.
 */
export function jsonLdScript(data: object): string {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  return `<script type="application/ld+json">${json}</script>`
}

export const SOCIAL_KEYS = ['social_facebook', 'social_twitter', 'social_instagram', 'social_youtube'] as const

/** The automatic robots.txt: block the admin, API and search results; point crawlers at the sitemaps. A hidden site blocks everything. */
export const buildRobotsTxt = (origin: string, hidden: boolean) =>
  hidden
    ? 'User-agent: *\nDisallow: /\n'
    : [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        'Disallow: /search',
        '',
        `Sitemap: ${origin}/sitemap.xml`,
        `Sitemap: ${origin}/sitemap-news.xml`,
        '',
      ].join('\n')

/**
 * What /robots.txt serves: the custom text from Settings when there is one, otherwise the automatic file.
 * "Allow search engines" switched off always wins, so hiding the site can never be undone by an old custom file.
 */
export function resolveRobotsTxt(origin: string, hidden: boolean, custom: string | null | undefined): string {
  if (hidden) return buildRobotsTxt(origin, true)
  const text = String(custom ?? '').replace(/\r\n?/g, '\n').trim()
  return text ? text + '\n' : buildRobotsTxt(origin, false)
}

/** The mistakes a person is likely to make in a hand-written robots.txt: lines a crawler would silently ignore. */
export function robotsTxtProblem(text: string): string | null {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    if (!/^[A-Za-z][A-Za-z-]*\s*:/.test(line)) return `line ${i + 1} is not a directive such as "User-agent: *" or "Disallow: /private"`
  }
  return null
}
