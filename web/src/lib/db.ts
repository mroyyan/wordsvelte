import { drizzle } from 'drizzle-orm/d1'
import * as schema from '@kubus/shared/src/db-schema'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb(platform: App.Platform | undefined) {
  if (!platform?.env.DB) throw new Error('D1 binding not available')
  if (!_db) _db = drizzle(platform.env.DB, { schema })
  return _db
}
