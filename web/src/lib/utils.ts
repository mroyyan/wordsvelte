import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Snippet } from 'svelte'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type WithElementRef<T> = T & {
  ref?: import('svelte').HTMLAttributes<HTMLElement>['ref']
}

export type WithoutChildrenOrChild<T> = Omit<T, 'children' | 'child'> & {
  children?: Snippet
  child?: Snippet<[{ props: Record<string, unknown> }]>
}

export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.includes('datetime')) return 'Baru saja'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return 'Baru saja'
  return d.toLocaleDateString('id-ID', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function formatExcerpt(html: string, maxLength = 200): string {
  const text = html.replace(/<[^>]*>/g, '').trim()
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}
