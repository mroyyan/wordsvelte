import { ValidationError } from '$lib/server/errors'

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

/** Raster images only. SVG is excluded on purpose: it can carry script and is served from our origin. */
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v)

/** Identify an image from its magic bytes, ignoring whatever the client claimed. */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = String.fromCharCode(...bytes.slice(8, 12))
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
  }
  return null
}

export function validateImageUpload(bytes: Uint8Array): { mimeType: string; ext: string } {
  if (bytes.byteLength === 0) throw new ValidationError('File is empty')
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new ValidationError('File too large (max 20MB)')
  const mimeType = sniffImageType(bytes)
  if (!mimeType) throw new ValidationError('Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, AVIF')
  return { mimeType, ext: IMAGE_TYPES[mimeType] }
}

export function buildMediaKey(ext: string, now = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${ext}`
}

/** Public media URLs must never expose internal storage namespaces (e.g. uploaded theme sources). */
export function isPublicMediaKey(key: string): boolean {
  if (!key || key.length > 512) return false
  if (key.includes('..') || key.includes('\\') || key.startsWith('/') || key.includes('\0')) return false
  if (key.startsWith('themes/')) return false
  return true
}
