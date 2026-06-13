import { json } from '@sveltejs/kit'
import { verifyAuth } from '$lib/server/auth'
import { scanThemes } from '$lib/server/themes'
import AdmZip from 'adm-zip'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const THEMES_DIR = join(__dirname, '..', '..', '..', '..', '..', 'themes')

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const formData = await event.request.formData()
    const file = formData.get('file') as File | null
    if (!file) return json({ success: false, error: 'No file uploaded' }, 400)
    if (!file.name.endsWith('.zip')) return json({ success: false, error: 'Only .zip files allowed' }, 400)

    const buffer = Buffer.from(await file.arrayBuffer())
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    // Find manifest.json to determine theme slug
    const manifestEntry = entries.find(e => e.entryName === 'manifest.json' || e.entryName.endsWith('/manifest.json'))
    if (!manifestEntry) return json({ success: false, error: 'manifest.json not found in zip root' }, 400)

    const manifestRaw = manifestEntry.getData().toString('utf-8')
    let manifest: any
    try { manifest = JSON.parse(manifestRaw) } catch { return json({ success: false, error: 'Invalid manifest.json' }, 400) }

    const slug = manifest.slug || file.name.replace('.zip', '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const themeDir = join(THEMES_DIR, slug)

    if (existsSync(themeDir)) return json({ success: false, error: `Theme "${slug}" already exists` }, 409)

    mkdirSync(themeDir, { recursive: true })

    for (const entry of entries) {
      if (entry.isDirectory) continue
      // Strip common base dir if zip contains a root folder
      const parts = entry.entryName.split('/')
      const baseDir = parts[0]
      const isNested = entries.some(e => e.entryName.startsWith(baseDir + '/') && e !== entry)
      const relPath = isNested ? parts.slice(1).join('/') : entry.entryName
      if (!relPath) continue

      const targetPath = join(themeDir, relPath)
      const targetDir = dirname(targetPath)
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })
      writeFileSync(targetPath, entry.getData())
    }

    scanThemes()

    return json({ success: true, data: { slug, name: manifest.name, version: manifest.version } }, 201)
  } catch (e: any) { return json({ success: false, error: e.message }, 500) }
}
