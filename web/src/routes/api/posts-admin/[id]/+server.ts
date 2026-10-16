import { getDb } from '$lib/server/db'
import { requireUser, hasRole, type AuthUser } from '$lib/server/auth'
import { catchError, ok, readJson } from '$lib/server/response'
import { getPostById, updatePost, deletePost } from '$lib/server/services/post.service'
import { ForbiddenError, ValidationError } from '$lib/server/errors'

function parseId(event: any): number {
  const id = Number(event.params.id)
  if (!Number.isInteger(id)) throw new ValidationError('Invalid id')
  return id
}

/** Authors may only touch their own posts; editors and admins may touch any. */
async function loadOwnedPost(db: any, user: AuthUser, id: number) {
  const post = await getPostById(db, id)
  if (!hasRole(user, 'editor') && post.authorId !== user.userId) throw new ForbiddenError('You can only manage your own posts')
  return post
}

export async function GET(event) {
  try {
    const user = await requireUser(event as any, 'author')
    return ok(await loadOwnedPost(getDb(event as any), user, parseId(event)))
  } catch (e) { return catchError(e) }
}

export async function PATCH(event) {
  try {
    const user = await requireUser(event as any, 'author')
    const db = getDb(event as any)
    const id = parseId(event)
    await loadOwnedPost(db, user, id)
    const body = await readJson(event.request)
    if (!hasRole(user, 'editor')) delete body.isFeatured
    await updatePost(db, id, body)
    return ok({})
  } catch (e) { return catchError(e) }
}

export async function DELETE(event) {
  try {
    const user = await requireUser(event as any, 'author')
    const db = getDb(event as any)
    const id = parseId(event)
    await loadOwnedPost(db, user, id)
    await deletePost(db, id)
    return ok({})
  } catch (e) { return catchError(e) }
}
