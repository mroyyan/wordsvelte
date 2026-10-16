import { describe, it, expect } from 'vitest'
import { getDb } from '$lib/server/db'
import { settings, menus } from '@wordsvelte/shared'

describe('migrations', () => {
  it('apply cleanly and seed generic defaults', async () => {
    const db = getDb()
    const rows = await db.select().from(settings)
    const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]))
    expect(map.site_name).toBe('WordSvelte')
    expect(map.admin_email).toBeUndefined()
    expect((await db.select().from(menus)).length).toBe(1)
  })
})
