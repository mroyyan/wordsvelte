import { eq } from 'drizzle-orm'
import { tags, toSlug } from '@wordsvelte/shared'
import { ValidationError, NotFoundError, ConflictError } from '$lib/server/core/errors'

interface CreateTagData {
  name: string
  slug?: string
}

interface UpdateTagData {
  name?: string
}

export async function listTags(db: any) {
  return db.select().from(tags).orderBy(tags.name)
}

export async function createTag(db: any, data: CreateTagData) {
  if (!data.name) throw new ValidationError('Name required')

  if (typeof data.name !== 'string' || data.name.length > 100) throw new ValidationError('Invalid name')
  const slug = toSlug(data.slug || data.name)
  if (!slug) throw new ValidationError('Invalid slug')
  const [taken] = await db.select({ id: tags.id }).from(tags).where(eq(tags.slug, slug)).limit(1)
  if (taken) throw new ConflictError('Tag already exists')
  const [tag] = await db.insert(tags).values({ name: data.name, slug }).returning()

  return tag
}

export async function updateTag(db: any, id: number, data: UpdateTagData) {
  if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100)) throw new ValidationError('Invalid name')
  await db.update(tags).set({ name: data.name }).where(eq(tags.id, id))

  const [tag] = await db.select().from(tags).where(eq(tags.id, id)).limit(1)
  if (!tag) throw new NotFoundError('Tag')

  return tag
}

export async function deleteTag(db: any, id: number) {
  await db.delete(tags).where(eq(tags.id, id))
}
