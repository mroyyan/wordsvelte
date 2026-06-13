import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '../shared/src/schema/index.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: '.local.db/portal.db'
  }
})
