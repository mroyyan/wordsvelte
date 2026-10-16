import { getDb } from '$lib/server/db'
import { requireUser } from '$lib/server/auth'
import { ok, created, catchError, readJson } from '$lib/server/http/response'
import { listPages, createPage } from '$lib/server/services/content/page.service'

/** Page management is an editorial task: editors and admins. */
export async function GET(event) {
  try {
    await requireUser(event as any, 'editor')
    return ok(await listPages(getDb(event as any), { status: event.url.searchParams.get('status') || 'all' }))
  } catch (e) { return catchError(e) }
}

export async function POST(event) {
  try {
    const user = await requireUser(event as any, 'editor')
    const body = await readJson(event.request)
    return created(await createPage(getDb(event as any), { ...body, authorId: user.userId }))
  } catch (e) { return catchError(e) }
}
