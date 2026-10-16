import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    // better-sqlite3 + jsdom (DOMPurify) are heavy; keep files isolated but run in parallel
    pool: 'forks',
    testTimeout: 20_000,
  },
})
