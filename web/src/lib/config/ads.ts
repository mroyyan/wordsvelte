import type { AdPlacement } from '@wordsvelte/shared'
import { msg } from '$lib/i18n/admin'

/** Admin-facing names for the places an ad can appear (the keys are fixed by the schema). */
export const AD_PLACEMENT_OPTIONS: { value: AdPlacement; label: string }[] = [
  { value: 'header', label: msg('Top of every page (below the menu)') },
  { value: 'sidebar-top', label: msg('Sidebar, above the widgets') },
  { value: 'sidebar-bottom', label: msg('Sidebar, below the widgets') },
  { value: 'article-top', label: msg('Article, before the text') },
  { value: 'in-article', label: msg('Article, inside the text (after the 2nd paragraph)') },
  { value: 'article-bottom', label: msg('Article, after the text') },
  { value: 'between-posts', label: msg('News list, after every 5th story') },
  { value: 'footer', label: msg('Bottom of every page (above the footer)') },
]

export const AD_DEVICE_OPTIONS: { value: 'all' | 'desktop' | 'mobile'; label: string }[] = [
  { value: 'all', label: msg('All devices') },
  { value: 'desktop', label: msg('Desktop and tablet only') },
  { value: 'mobile', label: msg('Phones only') },
]
