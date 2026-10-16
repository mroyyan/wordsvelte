import type { DbInstance } from '$lib/server/db'
import { toSlug } from '@wordsvelte/shared'
import { createTagRepository } from '$lib/server/repositories/tags.repository'
import { ValidationError, NotFoundError, ConflictError } from '$lib/server/core/errors'

interface CreateTagData {
  name: string
  slug?: string
}

interface UpdateTagData {
  name?: string
}

export async function listTags(db: DbInstance) {
  return createTagRepository(db).list()
}

export async function createTag(db: DbInstance, data: CreateTagData) {
  if (!data.name) throw new ValidationError('Name required')

  if (typeof data.name !== 'string' || data.name.length > 100) throw new ValidationError('Invalid name')
  const slug = toSlug(data.slug || data.name)
  if (!slug) throw new ValidationError('Invalid slug')
  const tags = createTagRepository(db)
  if (await tags.slugExists(slug)) throw new ConflictError('Tag already exists')
  return tags.insert({ name: data.name, slug })
}

export async function updateTag(db: DbInstance, id: number, data: UpdateTagData) {
  if (data.name !== undefined && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 100)) throw new ValidationError('Invalid name')
  const tags = createTagRepository(db)
  await tags.updateName(id, data.name)

  const tag = await tags.findById(id)
  if (!tag) throw new NotFoundError('Tag')

  return tag
}

export async function deleteTag(db: DbInstance, id: number) {
  await createTagRepository(db).delete(id)
}
