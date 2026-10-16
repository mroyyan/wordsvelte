import { eq } from 'drizzle-orm'
import { categories, toSlug } from '@wordsvelte/shared'
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

export async function listCategories(db: any) {
  return db.select().from(categories).orderBy(categories.name)
}

export async function createCategory(db: any, data: CreateCategoryData) {
  if (!data.name) throw new ValidationError('Name required')

  if (typeof data.name !== 'string' || data.name.length > 200) throw new ValidationError('Invalid name')
  const slug = toSlug(data.slug || data.name)
  if (!slug) throw new ValidationError('Invalid slug')
  const [taken] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1)
  if (taken) throw new ConflictError('Category already exists')
  const [cat] = await db.insert(categories).values({
    name: data.name,
    slug,
    description: data.description || null,
    parentId: data.parentId || null
  }).returning()

  return cat
}

export async function updateCategory(db: any, id: number, data: UpdateCategoryData) {
  const updateData: any = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.parentId !== undefined) updateData.parentId = data.parentId

  await db.update(categories).set(updateData).where(eq(categories.id, id))

  const [cat] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
  if (!cat) throw new NotFoundError('Category')

  return cat
}

export async function deleteCategory(db: any, id: number) {
  await db.delete(categories).where(eq(categories.id, id))
}
