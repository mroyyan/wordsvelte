import { XMLParser } from 'fast-xml-parser'
import { eq, sql } from 'drizzle-orm'
import { posts, categories, tags, postCategories, postTags, media, comments } from '@wordsvelte/shared'
import { toSlug } from '@wordsvelte/shared/src/utils/slug'

// --- Types ---

export interface MigratePreview {
  posts: number
  categories: number
  tags: number
  images: number
  comments: number
}

export interface MigrateProgress {
  stage: 'categories' | 'tags' | 'images' | 'posts' | 'comments' | 'done' | 'error'
  current: number
  total: number
  message: string
  // done stage extras
  totalPosts?: number
  totalCategories?: number
  totalTags?: number
  totalImages?: number
  totalComments?: number
  errors?: number
}

interface WxrItem {
  title?: string
  guid?: string
  'wp:post_type'?: string
  'wp:post_name'?: string
  'wp:status'?: string
  'wp:post_id'?: number
  'wp:post_date'?: string
  'wp:attachment_url'?: string
  'content:encoded'?: string
  'excerpt:encoded'?: string
  category?: Array<{ '@_domain': string; '@_nicename': string; '#text': string }> | { '@_domain': string; '@_nicename': string; '#text': string }
  'wp:postmeta'?: WxrPostMeta | WxrPostMeta[]
  'wp:comment'?: WxrComment | WxrComment[]
}

interface WxrPostMeta {
  'wp:meta_key'?: string
  'wp:meta_value'?: string
}

interface WxrComment {
  'wp:comment_id'?: number
  'wp:comment_author'?: string
  'wp:comment_author_email'?: string
  'wp:comment_content'?: string
  'wp:comment_approved'?: string | number
  'wp:comment_parent'?: number
  'wp:comment_date'?: string
}

// --- XML Parsing ---

function parseWxr(xml: string) {
  const parser = new XMLParser({
    isArray: (name) => {
      if (name === 'category') return true
      if (name === 'wp:postmeta') return true
      if (name === 'wp:comment') return true
      if (name === 'item') return true
      return false
    },
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
  })
  return parser.parse(xml)
}

function normalizeCategories(raw: unknown): Array<{ domain: string; nicename: string; text: string }> {
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr.map((c: any) => ({
    domain: c['@_domain'] || '',
    nicename: c['@_nicename'] || '',
    text: c['#text'] || '',
  }))
}

function normalizePostMeta(raw: unknown): WxrPostMeta[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

function normalizeComments(raw: unknown): WxrComment[] {
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

// --- Preview ---

export function getPreview(xml: string): MigratePreview {
  const parsed = parseWxr(xml)
  const items: WxrItem[] = parsed?.rss?.channel?.item || []

  let postCount = 0
  let categoryCount = 0
  let tagCount = 0
  let imageCount = 0
  let commentCount = 0
  const categorySlugs = new Set<string>()
  const tagSlugs = new Set<string>()
  const imageUrls = new Set<string>()

  for (const item of items) {
    const type = item['wp:post_type']
    if (type === 'post') {
      postCount++
      const cats = normalizeCategories(item.category)
      for (const c of cats) {
        if (c.domain === 'category') categorySlugs.add(c.nicename)
        else if (c.domain === 'post_tag') tagSlugs.add(c.nicename)
      }
      const metas = normalizePostMeta(item['wp:postmeta'])
      for (const m of metas) {
        if (m['wp:meta_key'] === '_thumbnail_id') {
          // count featured images
        }
      }
      const commentsList = normalizeComments(item['wp:comment'])
      commentCount += commentsList.length
    } else if (type === 'attachment') {
      const url = item['wp:attachment_url']
      if (url && isImageUrl(url)) {
        imageUrls.add(url)
        imageCount++
      }
    }
  }

  // Also count images referenced in content
  for (const item of items) {
    if (item['wp:post_type'] !== 'post') continue
    const content = item['content:encoded'] || ''
    const urls = extractImageUrls(content)
    for (const url of urls) {
      if (!imageUrls.has(url)) {
        imageUrls.add(url)
        imageCount++
      }
    }
  }

  categoryCount = categorySlugs.size
  tagCount = tagSlugs.size

  return { posts: postCount, categories: categoryCount, tags: tagCount, images: imageCount, comments: commentCount }
}

// --- Image URL Helpers ---

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|svg|bmp|tiff?|ico|avif)/i

function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSIONS.test(url.split('?')[0])
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = []
  // src="..." in img tags
  const srcRegex = /<img[^>]+src=["']([^"']+)["']/gi
  let match
  while ((match = srcRegex.exec(html)) !== null) {
    if (isImageUrl(match[1])) urls.push(match[1])
  }
  // data-src for lazy loaded
  const dataSrcRegex = /<img[^>]+data-src=["']([^"']+)["']/gi
  while ((match = dataSrcRegex.exec(html)) !== null) {
    if (isImageUrl(match[1])) urls.push(match[1])
  }
  return [...new Set(urls)]
}

function resolveAttachmentUrl(attachmentId: number, items: WxrItem[]): string | null {
  for (const item of items) {
    if (item['wp:post_type'] === 'attachment' && item['wp:post_id'] === attachmentId) {
      return item['wp:attachment_url'] || null
    }
  }
  return null
}

// --- Content Cleanup ---

function cleanContent(html: string, wpBaseUrl: string, urlMap: Map<string, string>): string {
  let result = html

  // Replace all image URLs in the content
  for (const [wpUrl, localUrl] of urlMap) {
    // Escape special regex chars in the URL
    const escaped = wpUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(escaped, 'g'), localUrl)
  }

  // Also try replacing domain-relative URLs
  try {
    const domain = new URL(wpBaseUrl).origin
    result = result.replace(new RegExp(domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
  } catch {}

  // Remove Gutenberg block comments
  result = result.replace(/<!-- wp:[\s\S]*?-->/g, '')
  result = result.replace(/<!-- \/wp:[\s\S]*?-->/g, '')

  // Strip shortcodes
  result = result.replace(/\[caption[^\]]*\][\s\S]*?\[\/caption\]/gi, '')
  result = result.replace(/\[gallery[^\]]*\]/gi, '')
  result = result.replace(/\[embed[^\]]*\][\s\S]*?\[\/embed\]/gi, '')
  result = result.replace(/\[audio[^\]]*\]/gi, '')
  result = result.replace(/\[video[^\]]*\]/gi, '')

  // Fix data-src → src
  result = result.replace(/data-src=/g, 'src=')

  return result
}

function cleanExcerpt(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

// --- Slug Helpers ---

async function getExistingSlugs(db: any, table: any, slugColumn: any): Promise<Set<string>> {
  const rows = await db.select({ slug: slugColumn }).from(table)
  return new Set(rows.map((r: any) => r.slug))
}

function uniqueSlug(slug: string, existing: Set<string>): string {
  let candidate = slug || toSlug('untitled')
  let i = 2
  while (existing.has(candidate)) {
    candidate = `${slug}-${i}`
    i++
  }
  existing.add(candidate)
  return candidate
}

// --- Image Download ---

async function downloadImage(url: string): Promise<{ buffer: ArrayBuffer; contentType: string; fileName: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'WordSvelte-Migrator/1.0' },
      signal: AbortSignal.timeout(30000),
    })
    if (!response.ok) return null
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()
    const fileName = url.split('/').pop()?.split('?')[0] || 'image.jpg'
    return { buffer, contentType, fileName }
  } catch {
    return null
  }
}

async function uploadToR2(r2: any, buffer: ArrayBuffer, contentType: string, fileName: string): Promise<string> {
  const now = new Date()
  const ext = fileName.split('.').pop() || 'jpg'
  const r2Key = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`
  await r2.put(r2Key, buffer, { httpMetadata: { contentType } })
  return r2Key
}

// --- Main Import ---

export async function runImport(
  xml: string,
  db: any,
  r2: any,
  userId: number,
  sendProgress: (p: MigrateProgress) => void,
) {
  const parsed = parseWxr(xml)
  const items: WxrItem[] = parsed?.rss?.channel?.item || []

  // Detect WP base URL from attachment URLs
  let wpBaseUrl = ''
  for (const item of items) {
    if (item['wp:attachment_url']) {
      try {
        const u = new URL(item['wp:attachment_url'])
        wpBaseUrl = `${u.protocol}//${u.host}`
        break
      } catch {}
    }
  }

  const errors = 0

  try {
    // --- Phase 1: Categories ---
    const existingCatSlugs = await getExistingSlugs(db, categories, categories.slug)
    const wpCategoryMap = new Map<string, number>() // nicename → db id
    const allCategories: Array<{ name: string; slug: string; parentNicename?: string }> = []

    for (const item of items) {
      if (item['wp:post_type'] !== 'post') continue
      const cats = normalizeCategories(item.category)
      for (const c of cats) {
        if (c.domain === 'category' && !wpCategoryMap.has(c.nicename)) {
          wpCategoryMap.set(c.nicename, -1) // placeholder
          allCategories.push({ name: c.text, slug: c.nicename })
        }
      }
    }

    // Insert categories (simple: no parent hierarchy for now, just flat)
    for (let i = 0; i < allCategories.length; i++) {
      const cat = allCategories[i]
      const slug = uniqueSlug(cat.slug, existingCatSlugs)
      sendProgress({ stage: 'categories', current: i + 1, total: allCategories.length, message: `Creating: ${cat.name}` })

      const [row] = await db.insert(categories).values({
        name: cat.name,
        slug,
      }).returning()
      wpCategoryMap.set(cat.slug, row.id)
    }

    // --- Phase 2: Tags ---
    const existingTagSlugs = await getExistingSlugs(db, tags, tags.slug)
    const wpTagMap = new Map<string, number>() // nicename → db id
    const allTags: Array<{ name: string; slug: string }> = []

    for (const item of items) {
      if (item['wp:post_type'] !== 'post') continue
      const cats = normalizeCategories(item.category)
      for (const c of cats) {
        if (c.domain === 'post_tag' && !wpTagMap.has(c.nicename)) {
          wpTagMap.set(c.nicename, -1)
          allTags.push({ name: c.text, slug: c.nicename })
        }
      }
    }

    for (let i = 0; i < allTags.length; i++) {
      const tag = allTags[i]
      const slug = uniqueSlug(tag.slug, existingTagSlugs)
      sendProgress({ stage: 'tags', current: i + 1, total: allTags.length, message: `Creating: ${tag.name}` })

      const [row] = await db.insert(tags).values({
        name: tag.name,
        slug,
      }).returning()
      wpTagMap.set(tag.slug, row.id)
    }

    // --- Phase 3: Images ---
    // Collect all image URLs from content + featured images
    const imageUrlSet = new Set<string>()
    const wpAttachmentMap = new Map<number, string>() // wp attachment id → wp url

    for (const item of items) {
      if (item['wp:post_type'] === 'attachment') {
        // wp:attachment_url is preferred, guid is fallback
        const url = item['wp:attachment_url'] || item['guid']
        if (url && isImageUrl(url) && item['wp:post_id']) {
          imageUrlSet.add(url)
          wpAttachmentMap.set(item['wp:post_id'], url)
        }
      }
    }

    // Also from content
    for (const item of items) {
      if (item['wp:post_type'] !== 'post') continue
      const content = item['content:encoded'] || ''
      const urls = extractImageUrls(content)
      for (const u of urls) imageUrlSet.add(u)
    }

    const allImageUrls = [...imageUrlSet]
    const urlToLocalMap = new Map<string, string>() // wp url → /api/media/r2Key

    // Download and upload images in batches of 5
    const BATCH_SIZE = 5
    for (let i = 0; i < allImageUrls.length; i += BATCH_SIZE) {
      const batch = allImageUrls.slice(i, i + BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          const downloaded = await downloadImage(url)
          if (!downloaded) return
          const r2Key = await uploadToR2(r2, downloaded.buffer, downloaded.contentType, downloaded.fileName)
          await db.insert(media).values({
            r2Key,
            originalName: downloaded.fileName,
            mimeType: downloaded.contentType,
            size: downloaded.buffer.byteLength,
            uploadedBy: userId,
          })
          return { url, r2Key }
        })
      )

      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        if (r.status === 'fulfilled' && r.value) {
          urlToLocalMap.set(r.value.url, `/api/media/${r.value.r2Key}`)
        }
        sendProgress({
          stage: 'images',
          current: Math.min(i + j + 1, allImageUrls.length),
          total: allImageUrls.length,
          message: `Downloading: ${batch[j].split('/').pop()?.split('?')[0] || 'image'}`,
        })
      }
    }

    // --- Phase 4: Posts ---
    const existingPostSlugs = await getExistingSlugs(db, posts, posts.slug)
    const wpPostMap = new Map<number, number>() // wp post id → db post id
    const postItems = items.filter(i => i['wp:post_type'] === 'post')

    for (let i = 0; i < postItems.length; i++) {
      const item = postItems[i]
      sendProgress({
        stage: 'posts',
        current: i + 1,
        total: postItems.length,
        message: `Importing: ${item.title || 'Untitled'}`,
      })

      const wpSlug = item['wp:post_name'] || toSlug(item.title || 'untitled')
      const slug = uniqueSlug(wpSlug, existingPostSlugs)
      const status = item['wp:status'] === 'publish' ? 'publish' : 'draft'

      let content = item['content:encoded'] || ''
      content = cleanContent(content, wpBaseUrl, urlToLocalMap)

      const excerpt = cleanExcerpt(item['excerpt:encoded'] || '')

      // Featured image
      let featuredImageUrl: string | null = null
      const metas = normalizePostMeta(item['wp:postmeta'])
      for (const m of metas) {
        if (m['wp:meta_key'] === '_thumbnail_id' && m['wp:meta_value']) {
          const attachmentId = parseInt(m['wp:meta_value'])
          const wpUrl = wpAttachmentMap.get(attachmentId)
          if (wpUrl) {
            const localUrl = urlToLocalMap.get(wpUrl)
            if (localUrl) {
              featuredImageUrl = localUrl
            } else {
              console.warn(`[migrate] Featured image URL not downloaded for post "${item.title}": ${wpUrl}`)
            }
          } else {
            console.warn(`[migrate] Attachment ID ${attachmentId} not found for post "${item.title}"`)
          }
        }
      }

      // Fallback: use first image from content as featured image
      if (!featuredImageUrl) {
        const rawContent = item['content:encoded'] || ''
        const contentImageUrls = extractImageUrls(rawContent)
        for (const url of contentImageUrls) {
          const localUrl = urlToLocalMap.get(url)
          if (localUrl) {
            featuredImageUrl = localUrl
            break
          }
        }
      }

      const publishedAt = status === 'publish'
        ? (item['wp:post_date'] ? item['wp:post_date'].replace(' ', 'T') : new Date().toISOString())
        : null

      const wpDate = item['wp:post_date']
        ? item['wp:post_date'].replace(' ', 'T')
        : new Date().toISOString()

      const [row] = await db.insert(posts).values({
        authorId: userId,
        title: item.title || 'Untitled',
        slug,
        excerpt: excerpt || null,
        content,
        status,
        featuredImageUrl,
        publishedAt,
        createdAt: wpDate,
        updatedAt: wpDate,
      }).returning()

      wpPostMap.set(item['wp:post_id'] || 0, row.id)

      // Link categories
      const cats = normalizeCategories(item.category)
      for (const c of cats) {
        if (c.domain === 'category') {
          const catId = wpCategoryMap.get(c.nicename)
          if (catId && catId > 0) {
            await db.insert(postCategories).values({ postId: row.id, categoryId: catId }).catch(() => {})
          }
        } else if (c.domain === 'post_tag') {
          const tagId = wpTagMap.get(c.nicename)
          if (tagId && tagId > 0) {
            await db.insert(postTags).values({ postId: row.id, tagId }).catch(() => {})
          }
        }
      }
    }

    // --- Phase 5: Comments ---
    const wpCommentMap = new Map<number, number>() // wp comment id → db comment id
    const allComments: Array<{ postId: number; comment: WxrComment; wpPostId: number }> = []

    for (const item of postItems) {
      const commentsList = normalizeComments(item['wp:comment'])
      for (const c of commentsList) {
        allComments.push({
          postId: wpPostMap.get(item['wp:post_id'] || 0) || 0,
          comment: c,
          wpPostId: item['wp:post_id'] || 0,
        })
      }
    }

    for (let i = 0; i < allComments.length; i++) {
      const { postId, comment } = allComments[i]
      if (!postId) continue

      sendProgress({
        stage: 'comments',
        current: i + 1,
        total: allComments.length,
        message: `Importing comment on post #${postId}`,
      })

      const wpCommentId = comment['wp:comment_id'] || 0
      const wpParentId = comment['wp:comment_parent'] || 0

      const parentId = wpParentId > 0 ? (wpCommentMap.get(wpParentId) || null) : null

      const approved = comment['wp:comment_approved'] === '1' || comment['wp:comment_approved'] === 1

      const createdAt = comment['wp:comment_date']
        ? comment['wp:comment_date'].replace(' ', 'T')
        : new Date().toISOString()

      const [row] = await db.insert(comments).values({
        postId,
        authorName: comment['wp:comment_author'] || 'Anonymous',
        authorEmail: comment['wp:comment_author_email'] || '',
        content: comment['wp:comment_content'] || '',
        status: approved ? 'approved' : 'pending',
        parentId,
        createdAt,
      }).returning()

      if (wpCommentId) wpCommentMap.set(wpCommentId, row.id)
    }

    // --- Done ---
    sendProgress({
      stage: 'done',
      current: 0,
      total: 0,
      message: 'Import complete',
      totalPosts: postItems.length,
      totalCategories: allCategories.length,
      totalTags: allTags.length,
      totalImages: allImageUrls.length,
      totalComments: allComments.length,
      errors,
    })
  } catch (err: any) {
    sendProgress({
      stage: 'error',
      current: 0,
      total: 0,
      message: err.message || 'Import failed',
    })
  }
}
