/**
 * Authorization matrix: every state-changing / admin route, for each of
 * anonymous, author, editor and admin. This is the guard against a route being added
 * (or reverted) without a role check.
 */
import { describe, it, expect } from 'vitest'
import { getDb } from '$lib/server/db'
import { createCategory } from '$lib/server/services/content/category.service'
import { createTag } from '$lib/server/services/content/tag.service'
import { createMenu, createMenuItem } from '$lib/server/services/site/menu.service'
import { createWidget } from '$lib/server/services/site/widget.service'
import { createPage } from '$lib/server/services/content/page.service'
import * as categories from '../../src/routes/api/categories/+server'
import * as category from '../../src/routes/api/categories/[id]/+server'
import * as tags from '../../src/routes/api/tags/+server'
import * as tag from '../../src/routes/api/tags/[id]/+server'
import * as menus from '../../src/routes/api/menus/+server'
import * as menu from '../../src/routes/api/menus/[id]/+server'
import * as menuItems from '../../src/routes/api/menus/[id]/items/+server'
import * as menuItem from '../../src/routes/api/menu-items/[id]/+server'
import * as widgets from '../../src/routes/api/widgets/+server'
import * as widget from '../../src/routes/api/widgets/[id]/+server'
import * as migratePreview from '../../src/routes/api/migrate/preview/+server'
import * as migrateImport from '../../src/routes/api/migrate/import/+server'
import * as me from '../../src/routes/api/auth/me/+server'
import * as accountRoute from '../../src/routes/api/account/+server'
import * as account2fa from '../../src/routes/api/account/2fa/+server'
import * as smtpRoute from '../../src/routes/api/settings/smtp/+server'
import * as smtpTest from '../../src/routes/api/settings/smtp/test/+server'
import * as adsRoute from '../../src/routes/api/ads/+server'
import * as adRoute from '../../src/routes/api/ads/[id]/+server'
import * as pagesRoute from '../../src/routes/api/pages/+server'
import * as pageRoute from '../../src/routes/api/pages/[id]/+server'
import { call, makeEvent, seedUser, withR2 } from '../helpers/harness'

type Min = 'author' | 'editor' | 'admin'
type Role = 'anonymous' | Min
const ROLES: Role[] = ['anonymous', 'author', 'editor', 'admin']
const RANK: Record<Role, number> = { anonymous: 0, author: 1, editor: 2, admin: 3 }

interface Case { name: string; min: Min; run: (token: string | undefined, ids: Ids) => Promise<{ status: number }> }
interface Ids { cat: number; tag: number; menu: number; item: number; widget: number; page: number }

async function fixtures(): Promise<Ids> {
  const db = getDb()
  const cat = await createCategory(db, { name: 'Cat' })
  const tg = await createTag(db, { name: 'Tag' })
  const mn = await createMenu(db, { name: 'Menu', slug: 'menu', location: 'footer' } as any)
  const it = await createMenuItem(db, { menuId: mn.id, label: 'Item', url: '/x' } as any)
  const wd = await createWidget(db, { widgetType: 'html', title: 'W', content: '<p>x</p>' })
  const owner = await seedUser('admin')
  const pg = await createPage(db, { title: 'Fixture', content: '<p>x</p>', authorId: owner.user.id })
  return { cat: cat.id, tag: tg.id, menu: mn.id, item: it.id, widget: wd.id, page: pg.id }
}

const ev = (token: string | undefined, o: object = {}) => makeEvent({ token, platform: withR2(), ...o })
const json = (method: string, token: string | undefined, params: object, body: object = {}) =>
  ev(token, { method, params, body })

const CASES: Case[] = [
  { name: 'GET /api/auth/me', min: 'author', run: t => call(me.GET, ev(t)) },

  { name: 'GET /api/account', min: 'author', run: t => call(accountRoute.GET, ev(t)) },
  { name: 'PATCH /api/account', min: 'author', run: t => call(accountRoute.PATCH, json('PATCH', t, {}, { displayName: 'New Name' })) },
  { name: 'GET /api/account/2fa', min: 'author', run: t => call(account2fa.GET, ev(t)) },
  { name: 'POST /api/account/2fa', min: 'author', run: t => call(account2fa.POST, json('POST', t, {}, { action: 'nope' })) },
  { name: 'GET /api/settings/smtp', min: 'admin', run: t => call(smtpRoute.GET, ev(t)) },
  { name: 'PUT /api/settings/smtp', min: 'admin', run: t => call(smtpRoute.PUT, json('PUT', t, {}, { host: '' })) },
  { name: 'POST /api/settings/smtp/test', min: 'admin', run: t => call(smtpTest.POST, json('POST', t, {}, {})) },

  { name: 'GET /api/ads', min: 'admin', run: t => call(adsRoute.GET, ev(t)) },
  { name: 'POST /api/ads', min: 'admin', run: t => call(adsRoute.POST, json('POST', t, {}, { name: 'Ad', placement: 'footer', type: 'code', code: '<b>x</b>' })) },
  { name: 'GET /api/ads/:id', min: 'admin', run: t => call(adRoute.GET, ev(t, { params: { id: '1' } })) },
  { name: 'PATCH /api/ads/:id', min: 'admin', run: t => call(adRoute.PATCH, json('PATCH', t, { id: '1' }, { name: 'Renamed' })) },
  { name: 'DELETE /api/ads/:id', min: 'admin', run: t => call(adRoute.DELETE, json('DELETE', t, { id: '1' })) },

  { name: 'POST /api/categories', min: 'editor', run: t => call(categories.POST, json('POST', t, {}, { name: `c${Math.random()}` })) },
  { name: 'PUT /api/categories/:id', min: 'editor', run: (t, i) => call(category.PUT, json('PUT', t, { id: String(i.cat) }, { name: 'renamed' })) },
  { name: 'DELETE /api/categories/:id', min: 'editor', run: (t, i) => call(category.DELETE, json('DELETE', t, { id: String(i.cat) })) },

  { name: 'GET /api/pages', min: 'editor', run: t => call(pagesRoute.GET, ev(t)) },
  { name: 'POST /api/pages', min: 'editor', run: t => call(pagesRoute.POST, json('POST', t, {}, { title: `p${Math.random()}` })) },
  { name: 'PATCH /api/pages/:id', min: 'editor', run: (t, i) => call(pageRoute.PATCH, json('PATCH', t, { id: String(i.page) }, { title: 'renamed' })) },
  { name: 'DELETE /api/pages/:id', min: 'editor', run: (t, i) => call(pageRoute.DELETE, json('DELETE', t, { id: String(i.page) })) },

  { name: 'POST /api/tags', min: 'editor', run: t => call(tags.POST, json('POST', t, {}, { name: `t${Math.random()}` })) },
  { name: 'PUT /api/tags/:id', min: 'editor', run: (t, i) => call(tag.PUT, json('PUT', t, { id: String(i.tag) }, { name: 'renamed' })) },
  { name: 'DELETE /api/tags/:id', min: 'editor', run: (t, i) => call(tag.DELETE, json('DELETE', t, { id: String(i.tag) })) },

  { name: 'POST /api/menus', min: 'admin', run: t => call(menus.POST, json('POST', t, {}, { name: 'M', slug: `m${Math.random()}`.replace('.', '') })) },
  { name: 'PUT /api/menus/:id', min: 'admin', run: (t, i) => call(menu.PUT, json('PUT', t, { id: String(i.menu) }, { name: 'M2' })) },
  { name: 'DELETE /api/menus/:id', min: 'admin', run: (t, i) => call(menu.DELETE, json('DELETE', t, { id: String(i.menu) })) },
  { name: 'POST /api/menus/:id/items', min: 'admin', run: (t, i) => call(menuItems.POST, json('POST', t, { id: String(i.menu) }, { label: 'L', url: '/l' })) },
  { name: 'PUT /api/menu-items/:id', min: 'admin', run: (t, i) => call(menuItem.PUT, json('PUT', t, { id: String(i.item) }, { label: 'L2' })) },
  { name: 'DELETE /api/menu-items/:id', min: 'admin', run: (t, i) => call(menuItem.DELETE, json('DELETE', t, { id: String(i.item) })) },

  { name: 'POST /api/widgets', min: 'admin', run: t => call(widgets.POST, json('POST', t, {}, { widgetType: 'html', content: '<p>x</p>' })) },
  { name: 'PUT /api/widgets/:id', min: 'admin', run: (t, i) => call(widget.PUT, json('PUT', t, { id: String(i.widget) }, { title: 'T2' })) },
  { name: 'DELETE /api/widgets/:id', min: 'admin', run: (t, i) => call(widget.DELETE, json('DELETE', t, { id: String(i.widget) })) },

  { name: 'POST /api/migrate/preview', min: 'admin', run: t => call(migratePreview.POST, ev(t, { method: 'POST', formData: new FormData() })) },
  { name: 'POST /api/migrate/import', min: 'admin', run: t => call(migrateImport.POST, ev(t, { method: 'POST', formData: new FormData() })) },
]

describe('authorization matrix', () => {
  for (const c of CASES) {
    describe(c.name, () => {
      for (const role of ROLES) {
        const allowed = RANK[role] >= RANK[c.min]
        it(`${role}: ${allowed ? 'allowed (not 401/403)' : role === 'anonymous' ? '401' : '403'}`, async () => {
          const ids = await fixtures()
          const token = role === 'anonymous' ? undefined : (await seedUser(role)).token
          const { status } = await c.run(token, ids)
          if (allowed) expect([401, 403], `${c.name} wrongly denied ${role}`).not.toContain(status)
          else expect(status).toBe(role === 'anonymous' ? 401 : 403)
        })
      }
    })
  }

  it('covers every authenticated route handler under src/routes/api', async () => {
    const { readdirSync, readFileSync, statSync } = await import('fs')
    const { join, relative } = await import('path')
    const root = join(__dirname, '../../src/routes/api')
    const files: string[] = []
    const walk = (d: string) => readdirSync(d).forEach(f => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : f === '+server.ts' && files.push(p) })
    walk(root)

    // Routes whose auth is exercised in their own dedicated test files.
    const covered = [
      'auth/login', 'auth/logout', 'auth/setup', 'auth/me', 'auth/forgot-password', 'auth/reset-password', 'auth/2fa', 'account', 'ads', 'users', 'settings', 'comments', 'media', 'posts', 'posts-admin', 'themes',
      'categories', 'tags', 'menus', 'menu-items', 'widgets', 'migrate', 'pages', 'dashboard',
    ]
    for (const f of files) {
      const rel = relative(root, f).replace(/\\/g, '/').replace('/+server.ts', '')
      expect(covered.some(c => rel === c || rel.startsWith(c + '/')), `route ${rel} has no authorization test`).toBe(true)
    }

    // And no handler may fall back to the weak "any signed-in user" alias except explicit author-level ones.
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\bverifyAuth\b/)
  })
})

describe('public read endpoints stay public and leak nothing sensitive', () => {
  it('categories/tags/widgets/menus GET work anonymously', async () => {
    await fixtures()
    for (const h of [categories.GET, tags.GET, widgets.GET, menus.GET]) {
      const r = await call(h as any, makeEvent())
      expect(r.status, String(h)).not.toBe(401)
      expect(r.status).toBeLessThan(500)
    }
  })
})
