import type { AdPlacement } from '@wordsvelte/shared'

/** What the public site needs to draw an ad. A banner's destination stays server-side: clicks go through /ads/:id/click. */
export interface PublicAd {
  id: number
  type: 'banner' | 'code'
  devices: 'all' | 'desktop' | 'mobile'
  imageUrl: string | null
  altText: string | null
  code: string | null
  href: string | null
}

export type AdsByPlacement = Partial<Record<AdPlacement, PublicAd[]>>

/** Tailwind classes that show an ad only on the devices it targets (by screen width: phones below md). */
export const deviceClass = (devices: PublicAd['devices']) => (devices === 'desktop' ? 'hidden md:block' : devices === 'mobile' ? 'md:hidden' : '')

/**
 * Cut article HTML after its n-th paragraph so an ad can sit between the two halves.
 * Returns null when the article is too short to have one in the middle.
 */
export function splitAfterParagraph(html: string, n: number): { head: string; tail: string } | null {
  let end = -1
  let from = 0
  for (let i = 0; i < n; i++) {
    const at = html.toLowerCase().indexOf('</p>', from)
    if (at < 0) return null
    end = at + '</p>'.length
    from = end
  }
  const tail = html.slice(end)
  // nothing but whitespace after the cut: the ad would simply be at the end
  return tail.replace(/<[^>]*>|\s/g, '') ? { head: html.slice(0, end), tail } : null
}
