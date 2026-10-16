import { xmlEscape } from '$lib/server/seo/sitemap'

/** CDATA cannot contain "]]>", so split it across two sections; control characters XML cannot hold are dropped. */
export const cdata = (s: unknown) =>
  `<![CDATA[${String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`

export interface RssItem {
  title: string
  link: string
  description: string
  contentHtml?: string
  pubDate: Date | null
  categories?: string[]
  author?: string | null
}

export function rssXml(site: { name: string; description: string; origin: string; language: string }, items: RssItem[], now = new Date()): string {
  const feedUrl = `${site.origin}/rss.xml`
  const body = items.map(i => `    <item>
      <title>${cdata(i.title)}</title>
      <link>${xmlEscape(i.link)}</link>
      <guid isPermaLink="true">${xmlEscape(i.link)}</guid>
      <description>${cdata(i.description)}</description>${i.contentHtml ? `\n      <content:encoded>${cdata(i.contentHtml)}</content:encoded>` : ''}${i.pubDate ? `\n      <pubDate>${i.pubDate.toUTCString()}</pubDate>` : ''}${i.author ? `\n      <dc:creator>${cdata(i.author)}</dc:creator>` : ''}${(i.categories ?? []).map(c => `\n      <category>${cdata(c)}</category>`).join('')}
    </item>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${cdata(site.name)}</title>
    <link>${xmlEscape(site.origin)}/</link>
    <description>${cdata(site.description || site.name)}</description>
    <language>${xmlEscape(site.language)}</language>
    <lastBuildDate>${(items.find(i => i.pubDate)?.pubDate ?? now).toUTCString()}</lastBuildDate>
    <atom:link href="${xmlEscape(feedUrl)}" rel="self" type="application/rss+xml" />
${body}
  </channel>
</rss>
`
}
