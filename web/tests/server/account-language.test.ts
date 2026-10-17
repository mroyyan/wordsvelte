import { describe, it, expect } from 'vitest'
import { requireUser } from '$lib/server/auth'
import * as account from '../../src/routes/api/account/+server'
import { load as adminLayout } from '../../src/routes/admin/+layout.server'
import { call, makeEvent, seedUser } from '../helpers/harness'

const patch = (token: string, body: object) => call(account.PATCH, makeEvent({ method: 'PATCH', token, body }))
const profile = (token: string) => call(account.GET, makeEvent({ token }))

describe('admin language of a user', () => {
  it('starts empty (follows the site language)', async () => {
    const u = await seedUser('editor')
    expect((await profile(u.token)).json.data.language).toBeNull()
  })

  it('can be set to a supported language and read back', async () => {
    const u = await seedUser('author')
    const r = await patch(u.token, { language: 'en' })
    expect(r.status, r.text).toBe(200)
    expect(r.json.data.language).toBe('en')
    expect((await profile(u.token)).json.data.language).toBe('en')
    expect((await requireUser(makeEvent({ token: u.token }))).language).toBe('en')
  })

  it('an empty value or null goes back to following the site language', async () => {
    const u = await seedUser('author')
    await patch(u.token, { language: 'id' })
    expect((await patch(u.token, { language: '' })).json.data.language).toBeNull()
    await patch(u.token, { language: 'en' })
    expect((await patch(u.token, { language: null })).json.data.language).toBeNull()
  })

  it('refuses a language the site does not have', async () => {
    const u = await seedUser('author')
    const r = await patch(u.token, { language: 'klingon' })
    expect(r.status).toBe(400)
    expect(r.json.error).toMatch(/Language must be one of: id, en/)
    expect((await profile(u.token)).json.data.language).toBeNull()
  })

  it('changing it leaves the other profile fields alone', async () => {
    const u = await seedUser('author')
    const before = (await profile(u.token)).json.data
    const after = (await patch(u.token, { language: 'en' })).json.data
    expect({ ...after, language: null }).toEqual({ ...before, language: null })
  })

  it('is handed to every admin page through the layout, so the whole panel switches at once', async () => {
    const u = await seedUser('editor')
    await patch(u.token, { language: 'en' })
    const data: any = await adminLayout(makeEvent({ token: u.token, path: '/admin/posts' }))
    expect(data.user.language).toBe('en')
  })

  it('is a personal choice: other accounts are not affected', async () => {
    const a = await seedUser('author')
    const b = await seedUser('author')
    await patch(a.token, { language: 'en' })
    expect((await profile(b.token)).json.data.language).toBeNull()
  })

  it('the anonymous cannot set it', async () => {
    const r = await call(account.PATCH, makeEvent({ method: 'PATCH', body: { language: 'en' } }))
    expect(r.status).toBe(401)
  })
})
