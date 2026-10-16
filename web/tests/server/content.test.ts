import { describe, it, expect } from 'vitest'
import { getDb } from '$lib/server/db'
import { createCategory, updateCategory, deleteCategory, listCategories } from '$lib/server/services/content/category.service'
import { createTag, updateTag, deleteTag, listTags } from '$lib/server/services/content/tag.service'
import { createWidget, updateWidget, getPublicWidgets } from '$lib/server/services/site/widget.service'
import { getPublicMenus } from '$lib/server/services/site/menu.service'
import { ConflictError, NotFoundError, ValidationError } from '$lib/server/core/errors'
import * as categoriesRoute from '../../src/routes/api/categories/+server'
import * as tagsRoute from '../../src/routes/api/tags/+server'
import * as menusRoute from '../../src/routes/api/menus/+server'
import * as widgetsRoute from '../../src/routes/api/widgets/+server'
import * as commentStatus from '../../src/routes/api/comments/[id]/status/+server'
import { call, makeEvent, seedUser } from '../helpers/harness'

describe('categories', () => {
  it('create/list/update/delete round-trip with generated slug', async () => {
    const c = await createCategory(getDb(), { name: 'Jawa Timur' })
    expect(c.slug).toBe('jawa-timur')
    expect((await listCategories(getDb())).map((x: any) => x.name)).toEqual(['Jawa Timur'])
    expect((await updateCategory(getDb(), c.id, { description: 'East Java' })).description).toBe('East Java')
    await deleteCategory(getDb(), c.id)
    expect(await listCategories(getDb())).toHaveLength(0)
    await expect(updateCategory(getDb(), c.id, { description: 'x' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('duplicate names/slugs are a 409, not a 500', async () => {
    await createCategory(getDb(), { name: 'Olahraga' })
    await expect(createCategory(getDb(), { name: 'Olahraga' })).rejects.toBeInstanceOf(ConflictError)
    await expect(createCategory(getDb(), { name: 'Other', slug: 'olahraga' })).rejects.toBeInstanceOf(ConflictError)
  })

  it.each([
    [{ name: '' }], [{ name: 'x'.repeat(201) }], [{ name: 5 as any }], [{ name: '!!!' }],
  ])('rejects invalid input %j', async data => {
    await expect(createCategory(getDb(), data as any)).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('tags', () => {
  it('create/update/delete and duplicate handling', async () => {
    const t = await createTag(getDb(), { name: 'Politik' })
    expect(t.slug).toBe('politik')
    await expect(createTag(getDb(), { name: 'politik' })).rejects.toBeInstanceOf(ConflictError)
    expect((await updateTag(getDb(), t.id, { name: 'Politik 2' })).name).toBe('Politik 2')
    await expect(updateTag(getDb(), t.id, { name: '   ' })).rejects.toBeInstanceOf(ValidationError)
    await expect(updateTag(getDb(), 999, { name: 'x' })).rejects.toBeInstanceOf(NotFoundError)
    await deleteTag(getDb(), t.id)
    expect(await listTags(getDb())).toHaveLength(0)
  })

  it.each([[{ name: '' }], [{ name: 'x'.repeat(101) }], [{ name: {} as any }]])('rejects invalid input %j', async data => {
    await expect(createTag(getDb(), data as any)).rejects.toBeInstanceOf(ValidationError)
  })
})

describe('widgets: free-form HTML is sanitised on write (it is rendered raw on every page)', () => {
  const dirty = '<p>hello</p><script>alert(1)</script><img src=x onerror=alert(2)><a href="javascript:alert(3)">x</a>'

  it('create', async () => {
    const w = await createWidget(getDb(), { widgetType: 'html', title: 'Ad', content: dirty })
    expect(w.content).toContain('<p>hello</p>')
    expect(w.content).not.toMatch(/<script|onerror|javascript:/i)
  })

  it('update (type taken from the stored widget when not resent)', async () => {
    const w = await createWidget(getDb(), { widgetType: 'html', content: '<p>ok</p>' })
    const updated = await updateWidget(getDb(), w.id, { content: dirty })
    expect(updated.content).not.toMatch(/<script|onerror|javascript:/i)
  })

  it('non-html widgets keep their content untouched', async () => {
    const w = await createWidget(getDb(), { widgetType: 'recent_posts', content: '5' })
    expect(w.content).toBe('5')
  })

  it('public widgets list returns active widgets only', async () => {
    const w = await createWidget(getDb(), { widgetType: 'html', content: '<p>hidden</p>' })
    await updateWidget(getDb(), w.id, { status: 'inactive' })
    const publicWidgets = await getPublicWidgets(getDb())
    expect(publicWidgets.every((x: any) => x.status === 'active' || x.status === undefined)).toBe(true)
    expect(JSON.stringify(publicWidgets)).not.toContain('hidden')
  })
})

describe('seed data from migrations', () => {
  it('ships generic defaults (no hard-coded site names or categories)', async () => {
    const menus = await getPublicMenus(getDb())
    expect(JSON.stringify(menus)).toContain('Beranda')
    expect(JSON.stringify(menus)).not.toMatch(/kediri|kubus|jawa timur/i)
    expect(await listCategories(getDb())).toHaveLength(0)
  })
})

describe('malformed JSON bodies are a 400 on every admin write endpoint (were 500)', () => {
  it.each([
    ['POST /api/categories', categoriesRoute.POST, 'editor'],
    ['POST /api/tags', tagsRoute.POST, 'editor'],
    ['POST /api/menus', menusRoute.POST, 'admin'],
    ['POST /api/widgets', widgetsRoute.POST, 'admin'],
  ] as const)('%s', async (_n, handler, role) => {
    const { token } = await seedUser(role)
    expect((await call(handler as any, makeEvent({ method: 'POST', body: '{broken', token }))).status).toBe(400)
    expect((await call(handler as any, makeEvent({ method: 'POST', body: '"a string"', token }))).status).toBe(400)
  })

  it('comment status endpoint', async () => {
    const { token } = await seedUser('editor')
    expect((await call(commentStatus.PATCH, makeEvent({ method: 'PATCH', params: { id: '1' }, body: '{broken', token }))).status).toBe(400)
  })

  it('duplicate category via the API is 409', async () => {
    const { token } = await seedUser('editor')
    const post = () => call(categoriesRoute.POST, makeEvent({ method: 'POST', body: { name: 'Dup' }, token }))
    expect((await post()).status).toBe(201)
    expect((await post()).status).toBe(409)
  })
})
