import { eq } from 'drizzle-orm'
import { categories, toSlug } from '@wordsvelte/shared'
import { ValidationError, NotFoundError } from '$lib/server/errors'

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

  const slug = data.slug || toSlug(data.name)
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
