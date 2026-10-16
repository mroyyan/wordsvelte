import { describe, it, expect } from 'vitest'
import { adminNav, navForRole, isActivePath, isCollapsible, flatNav, activeSubHref } from '../../src/lib/config/admin-nav'
import { isAuthPage, AUTH_PAGES } from '../../src/lib/config/auth-pages'

const titles = (role: any) => navForRole(role).flatMap(g => g.items.flatMap(i => (isCollapsible(i) ? [i.title, ...i.items.map(s => `${i.title}/${s.title}`)] : [i.title])))

describe('navForRole mirrors the server permissions', () => {
  it('authors only see content they can actually use', () => {
    const t = titles('author')
    expect(t).toEqual(expect.arrayContaining(['Dashboard', 'Posts', 'Posts/All Posts', 'Posts/New Post', 'Media']))
    for (const hidden of ['Posts/Categories', 'Posts/Tags', 'Comments', 'Themes', 'Widgets', 'Menus', 'Users', 'Migrate', 'Settings']) expect(t).not.toContain(hidden)
  })

  it('editors additionally get categories, tags and comments but no admin tools', () => {
    const t = titles('editor')
    expect(t).toEqual(expect.arrayContaining(['Posts/Categories', 'Posts/Tags', 'Comments']))
    for (const hidden of ['Themes', 'Widgets', 'Menus', 'Users', 'Migrate', 'Settings']) expect(t).not.toContain(hidden)
  })

  it('admins see everything', () => {
    const all = adminNav.flatMap(g => g.items.flatMap(i => (isCollapsible(i) ? i.items.map(s => s.title) : [i.title])))
    const t = titles('admin')
    for (const name of all) expect(t.some(x => x === name || x.endsWith('/' + name))).toBe(true)
  })

  it('drops groups that end up empty and unknown roles default to the least privilege', () => {
    expect(navForRole('author').map(g => g.title)).toEqual(['General'])
    expect(titles(undefined)).toEqual(titles('author'))
  })

  it('does not mutate the shared config', () => {
    const before = JSON.stringify(adminNav.map(g => g.items.length))
    navForRole('author')
    expect(JSON.stringify(adminNav.map(g => g.items.length))).toBe(before)
  })

  it('every link points inside /admin and no route is listed twice', () => {
    const hrefs = flatNav(adminNav).map(e => e.href)
    expect(hrefs.every(h => h.startsWith('/admin'))).toBe(true)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})

describe('isActivePath', () => {
  it('matches the dashboard exactly and everything else by prefix at a path boundary', () => {
    expect(isActivePath('/admin', '/admin')).toBe(true)
    expect(isActivePath('/admin/posts', '/admin')).toBe(false)
    expect(isActivePath('/admin/posts', '/admin/posts')).toBe(true)
    expect(isActivePath('/admin/posts/12', '/admin/posts')).toBe(true)
    expect(isActivePath('/admin/posts-archive', '/admin/posts')).toBe(false)
    expect(isActivePath('/admin/media', '/admin/posts')).toBe(false)
  })
})

describe('auth pages', () => {
  it.each(AUTH_PAGES)('%s renders without the admin shell (also with a trailing slash)', p => {
    expect(isAuthPage(p)).toBe(true)
    expect(isAuthPage(p + '/')).toBe(true)
  })
  it.each(['/admin', '/admin/users', '/admin/login/extra', '/admin/loginx', '/login'])('%s is not an auth page', p => {
    expect(isAuthPage(p)).toBe(false)
  })
})

describe('activeSubHref (submenu highlighting)', () => {
  const posts = [{ href: '/admin/posts' }, { href: '/admin/posts/new' }, { href: '/admin/categories' }]
  it('picks the most specific sub-item and never two at once', () => {
    expect(activeSubHref('/admin/posts', posts)).toBe('/admin/posts')
    expect(activeSubHref('/admin/posts/12', posts)).toBe('/admin/posts')
    expect(activeSubHref('/admin/posts/new', posts)).toBe('/admin/posts/new')
    expect(activeSubHref('/admin/categories', posts)).toBe('/admin/categories')
  })
  it('returns null outside the group and respects path boundaries', () => {
    expect(activeSubHref('/admin/media', posts)).toBeNull()
    expect(activeSubHref('/admin/posts-archive', posts)).toBeNull()
    expect(activeSubHref('/admin', posts)).toBeNull()
  })
})

describe('Pages has the same submenu shape as Posts', () => {
  const group = (title: string) => adminNav.flatMap(g => g.items).find(i => i.title === title)!
  it('both are collapsible with a list and a "new" entry', () => {
    for (const [title, list] of [['Posts', 'posts'], ['Pages', 'pages']] as const) {
      const item = group(title)
      expect(isCollapsible(item)).toBe(true)
      const hrefs = (item as any).items.map((i: any) => i.href)
      expect(hrefs).toEqual(expect.arrayContaining([`/admin/${list}`, `/admin/${list}/new`]))
    }
  })
  it('Pages is for editors and up; authors do not see it', () => {
    expect(titles('author')).not.toContain('Pages')
    expect(titles('editor')).toEqual(expect.arrayContaining(['Pages', 'Pages/All Pages', 'Pages/New Page']))
  })
})
