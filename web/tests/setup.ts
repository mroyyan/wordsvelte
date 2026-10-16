import { beforeEach } from 'vitest'
import { setDb } from '$lib/server/db'
import { resetAuthCache } from '$lib/server/auth'
import { setThemeStorage } from '$lib/server/themes/storage'
import { createSqliteDb } from '$lib/server/db/local'
import * as limiters from '$lib/server/limiters'

// Every test starts from a freshly migrated in-memory database (real migrations, incl. seed data).
beforeEach(() => {
  setDb(createSqliteDb(':memory:'))
  setThemeStorage(null)
  resetAuthCache()
  for (const limiter of Object.values(limiters)) limiter.clear()
})
