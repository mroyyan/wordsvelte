import type { Component } from 'svelte'
import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard'
import FileTextIcon from '@lucide/svelte/icons/file-text'
import ImageIcon from '@lucide/svelte/icons/image'
import FileStackIcon from '@lucide/svelte/icons/file-stack'
import MessageSquareIcon from '@lucide/svelte/icons/message-square'
import UsersIcon from '@lucide/svelte/icons/users'
import SettingsIcon from '@lucide/svelte/icons/settings'
import PaletteIcon from '@lucide/svelte/icons/palette'
import LayoutTemplateIcon from '@lucide/svelte/icons/layout-template'
import MenuIcon from '@lucide/svelte/icons/menu'
import WrenchIcon from '@lucide/svelte/icons/wrench'
import type { Role } from '@wordsvelte/shared'

export interface NavLink {
  title: string
  href: string
  icon?: Component<any>
  /** Lowest role that can see this entry (defaults to author). */
  minRole?: Role
}

export interface NavCollapsible {
  title: string
  icon?: Component<any>
  items: NavLink[]
  minRole?: Role
}

export type NavItem = NavLink | NavCollapsible
export interface NavGroupConfig {
  title: string
  items: NavItem[]
}

const RANK: Record<Role, number> = { author: 1, editor: 2, admin: 3 }

export const adminNav: NavGroupConfig[] = [
  {
    title: 'General',
    items: [
      { title: 'Dashboard', href: '/admin', icon: LayoutDashboardIcon },
      {
        title: 'Posts',
        icon: FileTextIcon,
        items: [
          { title: 'All Posts', href: '/admin/posts' },
          { title: 'New Post', href: '/admin/posts/new' },
          { title: 'Categories', href: '/admin/categories', minRole: 'editor' },
          { title: 'Tags', href: '/admin/tags', minRole: 'editor' },
        ],
      },
      {
        title: 'Pages',
        icon: FileStackIcon,
        minRole: 'editor',
        items: [
          { title: 'All Pages', href: '/admin/pages' },
          { title: 'New Page', href: '/admin/pages/new' },
        ],
      },
      { title: 'Media', href: '/admin/media', icon: ImageIcon },
      { title: 'Comments', href: '/admin/comments', icon: MessageSquareIcon, minRole: 'editor' },
    ],
  },
  {
    title: 'Appearance',
    items: [
      { title: 'Themes', href: '/admin/appearance/themes', icon: PaletteIcon, minRole: 'admin' },
      { title: 'Widgets', href: '/admin/appearance/widgets', icon: LayoutTemplateIcon, minRole: 'admin' },
      { title: 'Menus', href: '/admin/appearance/menus', icon: MenuIcon, minRole: 'admin' },
    ],
  },
  {
    title: 'Administration',
    items: [
      { title: 'Users', href: '/admin/users', icon: UsersIcon, minRole: 'admin' },
      { title: 'Migrate', href: '/admin/tools/migrate', icon: WrenchIcon, minRole: 'admin' },
      { title: 'Settings', href: '/admin/settings', icon: SettingsIcon, minRole: 'admin' },
    ],
  },
]

export const isCollapsible = (item: NavItem): item is NavCollapsible => 'items' in item

const canSee = (role: Role | undefined, min: Role = 'author') => RANK[role ?? 'author'] >= RANK[min]

/** Hide entries (and empty groups/sections) the signed-in role cannot use. The server enforces this independently. */
export function navForRole(role: Role | undefined, groups: NavGroupConfig[] = adminNav): NavGroupConfig[] {
  return groups
    .map(group => ({
      ...group,
      items: group.items
        .filter(item => canSee(role, item.minRole))
        .map(item => (isCollapsible(item) ? { ...item, items: item.items.filter(i => canSee(role, i.minRole)) } : item))
        .filter(item => !isCollapsible(item) || item.items.length > 0),
    }))
    .filter(group => group.items.length > 0)
}

/**
 * Which sub-item of a collapsible group is current: the most specific match wins, so /admin/posts/12 highlights
 * "All Posts" while /admin/posts/new highlights "New Post" (and never both).
 */
export function activeSubHref(pathname: string, items: { href: string }[]): string | null {
  let best: string | null = null
  for (const { href } of items) {
    if ((pathname === href || pathname.startsWith(href + '/')) && (best === null || href.length > best.length)) best = href
  }
  return best
}

/** Is `href` the current page (exact for the dashboard root, prefix for everything else)? */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(href + '/')
}

export const flatNav = (groups: NavGroupConfig[]) =>
  groups.flatMap(g => g.items.flatMap(i => (isCollapsible(i) ? i.items.map(s => ({ ...s, group: g.title, parent: i.title, icon: i.icon })) : [{ ...i, group: g.title, parent: undefined as string | undefined }])))
