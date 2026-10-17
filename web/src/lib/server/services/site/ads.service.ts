import type { DbInstance } from '$lib/server/db'
import { AD_DEVICES, AD_PLACEMENTS, AD_TYPES, type AdPlacement } from '@wordsvelte/shared'
import { NotFoundError, ValidationError } from '$lib/server/core/errors'
import type { AdsByPlacement, PublicAd } from '$lib/shared/ads'
import { createAdRepository, type AdPatch, type AdRow } from '$lib/server/repositories/ads.repository'

const MAX_NAME = 100
const MAX_ALT = 150
const MAX_CODE = 20_000
const STATUSES = ['active', 'paused'] as const

export interface AdInput {
  name?: unknown
  placement?: unknown
  type?: unknown
  imageUrl?: unknown
  linkUrl?: unknown
  altText?: unknown
  code?: unknown
  devices?: unknown
  startsAt?: unknown
  endsAt?: unknown
  status?: unknown
  sortOrder?: unknown
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function oneOf<T extends string>(list: readonly T[], v: unknown, label: string): T {
  if (!list.includes(v as T)) throw new ValidationError(`${label} must be one of: ${list.join(', ')}`)
  return v as T
}

function webUrl(v: string, label: string, opts: { allowPath?: boolean } = {}): string {
  if (opts.allowPath && v.startsWith('/') && !v.startsWith('//')) return v
  try {
    const u = new URL(v)
    if (u.protocol === 'http:' || u.protocol === 'https:') return v
  } catch { /* fall through */ }
  throw new ValidationError(`${label} must be a full URL starting with http:// or https://`)
}

/** An optional moment, normalised to ISO; an empty value clears it. */
function optionalInstant(v: unknown, label: string): string | null {
  if (v === undefined || v === null || v === '') return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) throw new ValidationError(`${label} is not a valid date`)
  return d.toISOString()
}

/** Validate a full ad (create) or merge a partial change onto the stored one (update) and validate the result. */
function build(input: AdInput, existing?: AdRow) {
  const pick = (k: keyof AdInput, stored: unknown) => (input[k] !== undefined ? input[k] : stored)

  const name = str(pick('name', existing?.name))
  if (!name) throw new ValidationError('Name is required')
  if (name.length > MAX_NAME) throw new ValidationError(`Name must be at most ${MAX_NAME} characters`)

  const placement = oneOf<AdPlacement>(AD_PLACEMENTS, pick('placement', existing?.placement), 'Placement')
  const type = oneOf(AD_TYPES, pick('type', existing?.type ?? 'banner'), 'Type')
  const devices = oneOf(AD_DEVICES, pick('devices', existing?.devices ?? 'all'), 'Devices')
  const status = oneOf(STATUSES, pick('status', existing?.status ?? 'active'), 'Status')

  const sortOrder = Number(pick('sortOrder', existing?.sortOrder ?? 0))
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) throw new ValidationError('Order must be a whole number between 0 and 9999')

  const startsAt = input.startsAt !== undefined ? optionalInstant(input.startsAt, 'Start date') : (existing?.startsAt ?? null)
  const endsAt = input.endsAt !== undefined ? optionalInstant(input.endsAt, 'End date') : (existing?.endsAt ?? null)
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) throw new ValidationError('The end date must be after the start date')

  let imageUrl: string | null = null
  let linkUrl: string | null = null
  let altText: string | null = null
  let code: string | null = null

  if (type === 'banner') {
    const image = str(pick('imageUrl', existing?.imageUrl))
    const link = str(pick('linkUrl', existing?.linkUrl))
    if (!image) throw new ValidationError('A banner needs an image')
    if (!link) throw new ValidationError('A banner needs a link')
    imageUrl = webUrl(image, 'Image', { allowPath: true })
    linkUrl = webUrl(link, 'Link')
    altText = str(pick('altText', existing?.altText)) || null
    if (altText && altText.length > MAX_ALT) throw new ValidationError(`Alt text must be at most ${MAX_ALT} characters`)
  } else {
    // Ad networks hand out <script> snippets, so this is deliberately not sanitised: only administrators can reach it.
    const raw = pick('code', existing?.code)
    code = typeof raw === 'string' ? raw.trim() : ''
    if (!code) throw new ValidationError('Paste the ad code')
    if (code.length > MAX_CODE) throw new ValidationError(`The ad code is too long (max ${MAX_CODE} characters)`)
  }

  return { name, placement, type, devices, status, sortOrder, startsAt, endsAt, imageUrl, linkUrl, altText, code }
}

export const listAds = (db: DbInstance) => createAdRepository(db).list()

export async function getAd(db: DbInstance, id: number) {
  const ad = await createAdRepository(db).findById(id)
  if (!ad) throw new NotFoundError('Ad')
  return ad
}

export async function createAd(db: DbInstance, input: AdInput) {
  return createAdRepository(db).insert(build(input))
}

export async function updateAd(db: DbInstance, id: number, input: AdInput) {
  const repo = createAdRepository(db)
  const existing = await repo.findById(id)
  if (!existing) throw new NotFoundError('Ad')
  await repo.update(id, build(input, existing) as AdPatch)
  return (await repo.findById(id))!
}

export async function deleteAd(db: DbInstance, id: number) {
  const repo = createAdRepository(db)
  if (!(await repo.findById(id))) throw new NotFoundError('Ad')
  await repo.delete(id)
}

export async function getRunningAds(db: DbInstance, now = new Date()): Promise<AdsByPlacement> {
  const out: AdsByPlacement = {}
  for (const ad of await createAdRepository(db).listRunning(now.toISOString())) {
    const placement = ad.placement as AdPlacement
    const banner = ad.type === 'banner'
    ;(out[placement] ??= []).push({
      id: ad.id,
      type: ad.type as PublicAd['type'],
      devices: ad.devices as PublicAd['devices'],
      imageUrl: banner ? ad.imageUrl : null,
      altText: banner ? ad.altText : null,
      code: banner ? null : ad.code,
      href: banner ? `/ads/${ad.id}/click` : null,
    })
  }
  return out
}

/** Count a click and return where it goes. Only running banner ads can be followed. */
export async function followAd(db: DbInstance, id: number, now = new Date()): Promise<string> {
  const repo = createAdRepository(db)
  const ad = await repo.findById(id)
  const iso = now.toISOString()
  const running = ad && ad.status === 'active' && ad.type === 'banner' && ad.linkUrl && (!ad.startsAt || ad.startsAt <= iso) && (!ad.endsAt || ad.endsAt > iso)
  if (!ad || !running) throw new NotFoundError('Ad')
  await repo.incrementClicks(id)
  return ad.linkUrl!
}
