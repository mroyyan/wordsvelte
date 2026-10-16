import type { DbInstance } from '$lib/server/db'
import { getSettings } from '$lib/server/services/site/settings.service'
import { siteOrigin } from '$lib/shared/seo'

export interface SiteInfo {
  settings: Record<string, string>
  /** Canonical origin: the configured Site URL, otherwise whatever address this request came in on. */
  origin: string
  name: string
  description: string
  language: string
  /** "Allow search engines" is off. */
  hidden: boolean
}

export async function getSite(db: DbInstance, requestOrigin: string): Promise<SiteInfo> {
  const settings = await getSettings(db)
  return {
    settings,
    origin: siteOrigin(settings.site_url, requestOrigin),
    name: settings.site_name || 'WordSvelte',
    description: settings.site_description || '',
    language: settings.language || 'id',
    hidden: settings.search_engine_visible === 'false',
  }
}
