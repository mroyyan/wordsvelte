import { json } from '@sveltejs/kit'
import { desc } from 'drizzle-orm'
import { getDb } from '$lib/server/db'
import { verifyAuth } from '$lib/server/auth'
import { media } from '@kubus/shared/src/db-schema'

export async function GET(event) {
  try {
    await verifyAuth(event as any)
    const db = getDb(event as any)
    const data = await db.select().from(media).orderBy(desc(media.createdAt))
    return json({ success: true, data })
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}

export async function POST(event) {
  try {
    const user = await verifyAuth(event as any)
    const formData = await event.request.formData()
    const file = formData.get('file') as File | null
    if (!file) return json({ success: false, error: 'No file' }, 400)

    const now = new Date()
    const r2Key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${file.name.split('.').pop()}`
    const buffer = await file.arrayBuffer()
    await (event.platform as any).env.R2.put(r2Key, buffer, { httpMetadata: { contentType: file.type } })

    const db = getDb(event as any)
    const [record] = await db.insert(media).values({ r2Key, originalName: file.name, mimeType: file.type, size: file.size, uploadedBy: user.userId }).returning()
    return json({ success: true, data: record }, 201)
  } catch (e: any) { return json({ success: false, error: e.message }, 401) }
}
