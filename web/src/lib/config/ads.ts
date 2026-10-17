import type { AdPlacement } from '@wordsvelte/shared'

/** Admin-facing names for the places an ad can appear (the keys are fixed by the schema). */
export const AD_PLACEMENT_OPTIONS: { value: AdPlacement; label: string }[] = [
  { value: 'header', label: 'Top of every page (below the menu)' },
  { value: 'sidebar-top', label: 'Sidebar, above the widgets' },
  { value: 'sidebar-bottom', label: 'Sidebar, below the widgets' },
  { value: 'article-top', label: 'Article, before the text' },
  { value: 'in-article', label: 'Article, inside the text (after the 2nd paragraph)' },
  { value: 'article-bottom', label: 'Article, after the text' },
  { value: 'between-posts', label: 'News list, after every 5th story' },
  { value: 'footer', label: 'Bottom of every page (above the footer)' },
]

export const AD_DEVICE_OPTIONS: { value: 'all' | 'desktop' | 'mobile'; label: string }[] = [
  { value: 'all', label: 'All devices' },
  { value: 'desktop', label: 'Desktop and tablet only' },
  { value: 'mobile', label: 'Phones only' },
]
