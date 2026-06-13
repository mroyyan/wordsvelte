import { z } from 'zod'

// ============ Auth ============
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})
export type LoginInput = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  displayName: z.string().min(1).max(100),
})
export type RegisterInput = z.infer<typeof registerSchema>

// ============ Posts ============
export const postSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  content: z.string().min(1),
  status: z.enum(['draft', 'publish', 'trash']).optional().default('draft'),
  featuredImageUrl: z.string().optional(),
  categoryIds: z.array(z.number()).optional(),
  tagIds: z.array(z.number()).optional(),
})
export type PostInput = z.infer<typeof postSchema>

export const postUpdateSchema = postSchema.partial()
export type PostUpdateInput = z.infer<typeof postUpdateSchema>

// ============ Categories ============
export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().optional(),
  description: z.string().optional(),
  parentId: z.number().nullable().optional(),
})
export type CategoryInput = z.infer<typeof categorySchema>

export const categoryUpdateSchema = categorySchema.partial()
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>

// ============ Tags ============
export const tagSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().optional(),
})
export type TagInput = z.infer<typeof tagSchema>

export const tagUpdateSchema = tagSchema.partial()
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>

// ============ Comments ============
export const commentSchema = z.object({
  postId: z.number(),
  authorName: z.string().min(1).max(100),
  authorEmail: z.string().email(),
  content: z.string().min(1).max(5000),
  parentId: z.number().nullable().optional(),
})
export type CommentInput = z.infer<typeof commentSchema>

export const commentStatusSchema = z.object({
  status: z.enum(['approved', 'pending', 'spam', 'trash']),
})
export type CommentStatusInput = z.infer<typeof commentStatusSchema>

// ============ Media ============
export const mediaDeleteSchema = z.object({
  id: z.number(),
})

// ============ Settings ============
export const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
})
export type SettingInput = z.infer<typeof settingSchema>

export const settingsBulkSchema = z.record(z.string(), z.string())
export type SettingsBulkInput = z.infer<typeof settingsBulkSchema>

// ============ Pagination ============
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})
export type PaginationInput = z.infer<typeof paginationSchema>

export const postFilterSchema = paginationSchema.extend({
  status: z.enum(['draft', 'publish', 'trash']).optional(),
  categoryId: z.coerce.number().int().optional(),
  tagId: z.coerce.number().int().optional(),
  authorId: z.coerce.number().int().optional(),
  search: z.string().optional(),
})
export type PostFilterInput = z.infer<typeof postFilterSchema>

// ============ Response types ============
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
