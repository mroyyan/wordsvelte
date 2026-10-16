import { requireUser } from '$lib/server/auth'
import { catchError, created } from '$lib/server/response'
import { scanThemes } from '$lib/server/services/theme.service'
import { getThemeStorage } from '$lib/server/themes/storage'
import { parseThemeZip } from '$lib/server/themes/zip'
import { ConflictError, ValidationError } from '$lib/server/errors'

export async function POST(event) {
  try {
    await requireUser(event as any, 'admin')
    const formData = await event.request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) throw new ValidationError('No file uploaded')
    if (!file.name.toLowerCase().endsWith('.zip')) throw new ValidationError('Only .zip files allowed')

    // Validates paths, file types, sizes and template syntax before anything is written.
    const theme = parseThemeZip(new Uint8Array(await file.arrayBuffer()), file.name)

    const platform = (event as any).platform
    const store = getThemeStorage(platform)
    if (await store.exists(theme.slug)) throw new ConflictError(`Theme "${theme.slug}" already exists`)

    await store.createDir(theme.slug)
    for (const f of theme.files) await store.writeFile(theme.slug, f.path, f.data)
    await scanThemes(platform)

    return created({ slug: theme.slug, name: theme.manifest.name, version: theme.manifest.version })
  } catch (e) { return catchError(e) }
}
