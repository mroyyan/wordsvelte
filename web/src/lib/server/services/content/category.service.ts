import type { DbInstance } from '$lib/server/db'
import { toSlug } from '@wordsvelte/shared'
import { createCategoryRepository, type CategoryPatch } from '$lib/server/repositories/categories.repository'
import { ValidationError, NotFoundError, ConflictError } from '$lib/server/core/errors'

interface CreateCategoryData {
  name: string
  slug?: string
  description?: string
  parentId?: number
}

interface UpdateCategoryData {
  name?: string
  description?: string
  parentId?: number
}

export async function listCategories(db: DbInstance) {
  return createCategoryRepository(db).list()
}

export async function createCategory(db: DbInstance, data: CreateCategoryData) {
  if (!data.name) throw new ValidationError('Name required')

  if (typeof data.name !== 'string' || data.name.length > 200) throw new ValidationError('Invalid name')
  const slug = toSlug(data.slug || data.name)
  if (!slug) throw new ValidationError('Invalid slug')
  const categories = createCategoryRepository(db)
  if (await categories.slugExists(slug)) throw new ConflictError('Category already exists')
  return categories.insert({
    name: data.name,
    slug,
    description: data.description || null,
    parentId: data.parentId || null
  })
}

export async function updateCategory(db: DbInstance, id: number, data: UpdateCategoryData) {
  const updateData: CategoryPatch = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.parentId !== undefined) updateData.parentId = data.parentId

  const categories = createCategoryRepository(db)
  await categories.update(id, updateData)

  const cat = await categories.findById(id)
  if (!cat) throw new NotFoundError('Category')

  return cat
}

export async function deleteCategory(db: DbInstance, id: number) {
  await createCategoryRepository(db).delete(id)
}
