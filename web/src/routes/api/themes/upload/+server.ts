import { json } from '@sveltejs/kit'
import { verifyAuth } from '$lib/server/auth'
import { catchError, ok, created } from '$lib/server/response'
import { scanThemes } from '$lib/server/services/theme.service'
import { getThemeStorage } from '$lib/server/themes/storage'
import { toSlug } from '@wordsvelte/shared'
import AdmZip from 'adm-zip'

export async function POST(event) {
  try {
    await verifyAuth(event as any)
    const formData = await event.request.formData()
    const file = formData.get('file') as File | null
    if (!file) return json({ success: false, error: 'No file uploaded' }, { status: 400 })
    if (!file.name.endsWith('.zip')) return json({ success: false, error: 'Only .zip files allowed' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return json({ success: false, error: 'File too large (max 10MB)' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const zip = new AdmZip(buffer)
    const entries = zip.getEntries()

    const manifestEntry = entries.find(e => e.entryName === 'manifest.json' || e.entryName.endsWith('/manifest.json'))
    if (!manifestEntry) return json({ success: false, error: 'manifest.json not found in zip root' }, { status: 400 })

    const manifestRaw = manifestEntry.getData().toString('utf-8')
    let manifest: any
    try { manifest = JSON.parse(manifestRaw) } catch { return json({ success: false, error: 'Invalid manifest.json' }, { status: 400 }) }

    const slug = manifest.slug || toSlug(file.name.replace('.zip', ''))

    const store = getThemeStorage((event as any).platform)
    if (await store.exists(slug)) return json({ success: false, error: `Theme "${slug}" already exists` }, { status: 409 })

    await store.createDir(slug)

    for (const entry of entries) {
      if (entry.isDirectory) continue
      const parts = entry.entryName.split('/')
      const baseDir = parts[0]
      const isNested = entries.some(e => e.entryName.startsWith(baseDir + '/') && e !== entry)
      const relPath = isNested ? parts.slice(1).join('/') : entry.entryName
      if (!relPath) continue
      await store.writeFile(slug, relPath, entry.getData())
    }

    await scanThemes((event as any).platform)

    return json({ success: true, data: { slug, name: manifest.name, version: manifest.version } }, { status: 201 })
  } catch (e: any) { return catchError(e) }
}
