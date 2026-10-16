import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Svelte component libraries must go through Vite during SSR; Node cannot import their .svelte files.
  ssr: { noExternal: ['svelte-sonner', 'mode-watcher'] },
  // The Workers runtime provides `cloudflare:*` modules (TCP sockets for SMTP) itself; they cannot be bundled.
  build: { rollupOptions: { external: [/^cloudflare:/] } },
  resolve: {
    alias: {
      'ckeditor5/dist/ckeditor5.css': resolve(__dirname, '../node_modules/ckeditor5/dist/ckeditor5.css')
    }
  }
})
