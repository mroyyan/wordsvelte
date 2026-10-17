import { sql } from 'drizzle-orm'
import { sqliteTable, text, integer, uniqueIndex, primaryKey, index, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

export const ROLES = ['admin', 'editor', 'author'] as const
export type Role = (typeof ROLES)[number]
export const POST_STATUSES = ['draft', 'pending', 'scheduled', 'publish'] as const

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').notNull().default('author'),
  avatarUrl: text('avatar_url'),
  /** Bumped on password change/reset and security changes; tokens carry the value they were issued under, so a bump signs every other device out. */
  sessionVersion: integer('session_version').notNull().default(0),
  /** AES-GCM encrypted TOTP secret (see secret-box). Set during setup, only trusted once totpEnabled is 1. */
  totpSecret: text('totp_secret'),
  totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
  /** Last accepted 30 s time step, so one authenticator code cannot be replayed. */
  totpLastStep: integer('totp_last_step'),
  email2faEnabled: integer('email_2fa_enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  authorId: integer('author_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  status: text('status').notNull().default('draft'),
  featuredImageUrl: text('featured_image_url'),
  isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  publishedAt: text('published_at'),
}, (table) => ({
  statusPublishedIdx: index('idx_posts_status_published').on(table.status, table.publishedAt),
  authorIdx: index('idx_posts_author').on(table.authorId),
}))

export const postMeta = sqliteTable('post_meta', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value').notNull(),
}, (table) => ({
  uniqueKey: uniqueIndex('idx_post_meta_key').on(table.postId, table.key),
}))

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  parentId: integer('parent_id').references((): AnySQLiteColumn => categories.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const postCategories = sqliteTable('post_categories', {
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.categoryId] }),
}))

export const postTags = sqliteTable('post_tags', {
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.postId, table.tagId] }),
}))

export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  r2Key: text('r2_key').notNull(),
  originalName: text('original_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  width: integer('width'),
  height: integer('height'),
  altText: text('alt_text'),
  caption: text('caption'),
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const comments = sqliteTable('comments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  authorName: text('author_name').notNull(),
  authorEmail: text('author_email').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull().default('pending'),
  parentId: integer('parent_id').references((): AnySQLiteColumn => comments.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  postStatusIdx: index('idx_comments_post_status').on(table.postId, table.status),
}))

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

export const widgets = sqliteTable('widgets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  widgetType: text('widget_type').notNull(),
  title: text('title'),
  content: text('content'),
  settings: text('settings'),
  sidebarArea: text('sidebar_area').notNull().default('sidebar-1'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

/** Static pages (About, Contact, ...). Served at /<slug>, so slugs are unique across posts and pages. */
export const pages = sqliteTable('pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  authorId: integer('author_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  content: text('content').notNull().default(''),
  status: text('status').notNull().default('draft'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  publishedAt: text('published_at'),
}, (table) => ({
  statusIdx: index('idx_pages_status').on(table.status),
}))

export const menus = sqliteTable('menus', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  location: text('location').notNull().default('header'),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const menuItems = sqliteTable('menu_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  menuId: integer('menu_id').notNull().references(() => menus.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id').references((): AnySQLiteColumn => menuItems.id),
  itemType: text('item_type').notNull().default('custom'),
  /** For item_type = 'page': the URL is resolved from the page slug so renames never break the menu. */
  pageId: integer('page_id').references(() => pages.id, { onDelete: 'set null' }),
  label: text('label').notNull(),
  url: text('url'),
  target: text('target').notNull().default('_self'),
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status').notNull().default('active'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

/** One-time password reset links. Only a SHA-256 hash of the token is stored, never the token itself. */
export const passwordResets = sqliteTable('password_resets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

/** Short-lived one-time codes sent by email (second factor at login, or confirming that email 2FA works). Only hashes are stored. */
export const twoFactorCodes = sqliteTable('two_factor_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose').notNull(),
  codeHash: text('code_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  userPurposeIdx: index('idx_2fa_codes_user_purpose').on(table.userId, table.purpose),
}))

/** Single-use backup codes for when the authenticator or inbox is unavailable. Only hashes are stored. */
export const recoveryCodes = sqliteTable('recovery_codes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),
  usedAt: text('used_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  userIdx: index('idx_recovery_codes_user').on(table.userId),
}))

/** Where an ad can appear on the public site. */
export const AD_PLACEMENTS = ['header', 'sidebar-top', 'sidebar-bottom', 'article-top', 'in-article', 'article-bottom', 'between-posts', 'footer'] as const
export type AdPlacement = (typeof AD_PLACEMENTS)[number]
/** 'banner' is an image with a link; 'code' is pasted HTML/JavaScript from an ad network (e.g. AdSense). */
export const AD_TYPES = ['banner', 'code'] as const
export type AdType = (typeof AD_TYPES)[number]
export const AD_DEVICES = ['all', 'desktop', 'mobile'] as const
export type AdDevice = (typeof AD_DEVICES)[number]

export const ads = sqliteTable('ads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  placement: text('placement').notNull(),
  type: text('type').notNull().default('banner'),
  imageUrl: text('image_url'),
  linkUrl: text('link_url'),
  altText: text('alt_text'),
  /** Raw markup for type 'code'. Only administrators can write it. */
  code: text('code'),
  devices: text('devices').notNull().default('all'),
  /** Optional run window, ISO 8601 (UTC). Empty means no limit on that side. */
  startsAt: text('starts_at'),
  endsAt: text('ends_at'),
  status: text('status').notNull().default('active'),
  sortOrder: integer('sort_order').notNull().default(0),
  clicks: integer('clicks').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => ({
  placementIdx: index('idx_ads_placement_status').on(table.placement, table.status),
}))
