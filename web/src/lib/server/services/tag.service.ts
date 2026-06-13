import { eq } from 'drizzle-orm'
import { tags, toSlug } from '@wordsvelte/shared'
import { ValidationError, NotFoundError } from '$lib/server/errors'

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

  const slug = data.slug || toSlug(data.name)
  const [tag] = await db.insert(tags).values({ name: data.name, slug }).returning()

  return tag
}

export async function updateTag(db: any, id: number, data: UpdateTagData) {
  await db.update(tags).set({ name: data.name }).where(eq(tags.id, id))

  const [tag] = await db.select().from(tags).where(eq(tags.id, id)).limit(1)
  if (!tag) throw new NotFoundError('Tag')

  return tag
}

export async function deleteTag(db: any, id: number) {
  await db.delete(tags).where(eq(tags.id, id))
}
