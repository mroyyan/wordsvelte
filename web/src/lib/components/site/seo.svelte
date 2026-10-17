<script lang="ts">
  import { t } from '$lib/i18n'
  import { page } from '$app/state'
  import {
    buildHead, jsonLdScript, organizationLd, websiteLd, newsArticleLd, webPageLd, breadcrumbLd,
    SOCIAL_KEYS, pageTitle, absoluteUrl,
  } from '$lib/shared/seo'

  /**
   * One place that writes all search/social metadata for a public page: title, description, canonical URL, robots,
   * Open Graph, Twitter card, article tags and JSON-LD. Site-level facts (name, language, defaults, the
   * "Allow search engines" switch) come from the page data, so callers only describe the page itself.
   */
  let {
    title = '',
    description = '',
    image = null,
    type = 'website',
    noindex = false,
    pageNumber,
    publishedAt = null,
    modifiedAt = null,
    authorName = null,
    section = null,
    tags = [],
    breadcrumbs = [],
    jsonLd = [],
    /** The home page: "<site> - <tagline>" title plus WebSite and Organization data. */
    home = false,
    /** A static page: adds WebPage data. */
    webPage = false,
  }: {
    title?: string
    description?: string | null
    image?: string | null
    type?: 'website' | 'article'
    noindex?: boolean
    pageNumber?: number
    publishedAt?: string | null
    modifiedAt?: string | null
    authorName?: string | null
    section?: string | null
    tags?: string[]
    /** Trail below "Beranda" (home), e.g. [{ name: 'Nasional', path: '/kategori/nasional' }, { name: post title, path: '/slug' }] */
    breadcrumbs?: { name: string; path: string }[]
    jsonLd?: object[]
    home?: boolean
    webPage?: boolean
  } = $props()

  const s = $derived((page.data.settings ?? {}) as Record<string, string>)
  const siteName = $derived(s.site_name || 'WordSvelte')
  const origin = $derived((page.data.siteUrl as string | undefined) ?? page.url.origin)

  const fullTitle = $derived.by(() => {
    if (home) {
      const base = s.site_description ? `${siteName} - ${s.site_description}` : siteName
      return pageNumber && pageNumber > 1 ? `${base} (${t('seo.pageNumber', { n: pageNumber })})` : base
    }
    const titled = pageNumber && pageNumber > 1 ? `${title} (${t('seo.pageNumber', { n: pageNumber })})` : title
    return pageTitle(titled, siteName)
  })

  const head = $derived(buildHead({
    siteName,
    siteUrl: origin,
    pathname: page.url.pathname,
    pageNumber,
    title: fullTitle,
    description,
    image,
    type,
    language: s.language,
    noindex,
    hideSite: s.search_engine_visible === 'false',
    defaults: { description: s.default_meta_description || s.site_description, image: s.default_og_image },
    publishedAt, modifiedAt, authorName, section, tags,
  }))

  const logo = $derived(absoluteUrl(origin, s.default_og_image))
  const social = $derived(SOCIAL_KEYS.map(k => s[k]).filter(v => /^https?:\/\//i.test(v ?? '')))

  const schema = $derived.by(() => {
    const out: object[] = []
    if (home) {
      out.push(websiteLd({ name: siteName, url: origin, description: s.site_description || undefined, searchUrl: `${origin}/search`, language: s.language }))
      out.push(organizationLd({ name: siteName, url: origin, logo, sameAs: social }))
    }
    if (type === 'article') {
      out.push(newsArticleLd({
        url: head.canonical, headline: title, description: head.description || undefined,
        images: head.og['og:image'] ? [head.og['og:image']] : [], published: publishedAt, modified: modifiedAt,
        authorName, publisherName: siteName, publisherLogo: logo, section, keywords: tags, language: s.language,
      }))
    }
    if (webPage) out.push(webPageLd({ url: head.canonical, name: title, description: head.description || undefined, modified: modifiedAt, language: s.language }))
    if (breadcrumbs.length) {
      out.push(breadcrumbLd([{ name: t('common.home'), url: `${origin}/` }, ...breadcrumbs.map(b => ({ name: b.name, url: `${origin}${b.path}` }))]))
    }
    return [...out, ...jsonLd]
  })
</script>

<svelte:head>
  <title>{head.title}</title>
  {#if head.description}<meta name="description" content={head.description} />{/if}
  <link rel="canonical" href={head.canonical} />
  <meta name="robots" content={head.robots} />

  {#each Object.entries(head.og) as [property, content] (property)}<meta {property} {content} />{/each}
  {#each Object.entries(head.twitter) as [name, content] (name)}<meta {name} {content} />{/each}

  {#if type === 'article'}
    {#if head.article.published_time}<meta property="article:published_time" content={head.article.published_time} />{/if}
    {#if head.article.modified_time}<meta property="article:modified_time" content={head.article.modified_time} />{/if}
    {#if head.article.author}<meta property="article:author" content={head.article.author} />{/if}
    {#if head.article.section}<meta property="article:section" content={head.article.section} />{/if}
    {#each head.article.tag as tag (tag)}<meta property="article:tag" content={tag} />{/each}
  {/if}

  {#each schema as data, i (i)}{@html jsonLdScript(data)}{/each}
</svelte:head>
