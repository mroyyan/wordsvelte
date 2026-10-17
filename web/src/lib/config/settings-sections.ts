import type { Component } from 'svelte'
import GlobeIcon from '@lucide/svelte/icons/globe'
import FileTextIcon from '@lucide/svelte/icons/file-text'
import MessageSquareIcon from '@lucide/svelte/icons/message-square'
import Share2Icon from '@lucide/svelte/icons/share-2'
import PanelBottomIcon from '@lucide/svelte/icons/panel-bottom'
import SearchIcon from '@lucide/svelte/icons/search'
import MailIcon from '@lucide/svelte/icons/mail'
import MegaphoneIcon from '@lucide/svelte/icons/megaphone'
import { msg } from '$lib/i18n/admin'
import { buildRobotsTxt } from '$lib/shared/seo'
import { DATE_FORMATS, DEFAULT_TIMEZONE, LANGUAGES, formatDateWith } from '$lib/shared/format-date'

export type Option = { value: string; label: string; params?: Record<string, string | number> }
export type Field = {
  key: string
  label: string
  type: 'text' | 'email' | 'url' | 'textarea' | 'select' | 'combobox' | 'switch'
  placeholder?: string
  desc?: string
  default?: string
  options?: Option[]
  /** Textareas: show in a monospace font and with this many rows. */
  mono?: boolean
  /** URL fields: add a Browse button that picks an image from the media library. */
  media?: boolean
  rows?: number
  /** Adds an "Insert default" button that fills the field with this text (given the site address). */
  defaultText?: (siteOrigin: string) => string
}
export type Section = { id: string; title: string; desc: string; icon: Component<any>; fields: Field[] }

const PRIORITY_ZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak']
function timezoneOptions(): Option[] {
  let all: string[] = []
  try { all = (Intl as any).supportedValuesOf('timeZone') } catch { /* very old runtime */ }
  const rest = all.filter(z => !PRIORITY_ZONES.includes(z))
  return [...PRIORITY_ZONES, 'UTC', ...rest.filter(z => z !== 'UTC')].map(z => ({ value: z, label: z.replaceAll('_', ' ') }))
}
const zones = timezoneOptions()

const perPage: Option[] = [5, 10, 12, 15, 20, 25, 30, 40, 50].map(n => ({ value: String(n), label: msg('{n} posts'), params: { n } }))
const closeAfter: Option[] = [
  { value: '0', label: msg('Never close') },
  { value: '7', label: msg('After 1 week') },
  { value: '14', label: msg('After 2 weeks') },
  { value: '30', label: msg('After 1 month') },
  { value: '60', label: msg('After 2 months') },
  { value: '90', label: msg('After 3 months') },
  { value: '180', label: msg('After 6 months') },
  { value: '365', label: msg('After 1 year') },
]

/** The Email section is not field-driven: it has its own form and endpoint (it stores an encrypted password). */
export const EMAIL_SECTION = { id: 'email', title: 'Email', desc: msg('Outgoing mail for password resets and sign-in codes'), icon: MailIcon }

/** Field-driven sections. The current values are needed because the date-format previews follow the chosen language and timezone. */
export function buildSections(values: Record<string, string> = {}): Section[] {
  const sample = new Date().toISOString()
  const dateFormatOptions: Option[] = DATE_FORMATS.map(f => ({
    value: f,
    label: `${formatDateWith(sample, { date_format: f, language: values.language, timezone: values.timezone })}   (${f})`,
  }))

  return [
    {
      id: 'general', title: msg('General'), desc: msg('Site title, tagline and regional settings.'), icon: GlobeIcon,
      fields: [
        { key: 'site_name', type: 'text', label: msg('Site title'), placeholder: msg('My Website') },
        { key: 'site_description', type: 'textarea', label: msg('Tagline'), placeholder: msg('A short description of your site') },
        { key: 'site_url', type: 'url', label: msg('Site URL'), placeholder: 'https://news.example.com', desc: msg('Your main address, used for canonical links, sitemaps, share cards and the RSS feed. Leave empty to detect it automatically.') },
        { key: 'admin_email', type: 'email', label: msg('Admin email'), placeholder: 'admin@example.com', desc: msg('Only visible to administrators.') },
        { key: 'language', type: 'select', label: msg('Language'), options: LANGUAGES.map(l => ({ value: l.value, label: l.label })), default: 'id', desc: msg('The language of the public site: its texts (menus, buttons, messages) and the month and day names.') },
        { key: 'timezone', type: 'combobox', label: msg('Timezone'), options: zones, default: DEFAULT_TIMEZONE, desc: msg('Publication dates are shown in this timezone.') },
        { key: 'date_format', type: 'select', label: msg('Date format'), options: dateFormatOptions, default: 'd F Y', desc: msg('How dates appear on articles and lists.') },
      ],
    },
    {
      id: 'reading', title: msg('Reading'), desc: msg('How posts are listed and found.'), icon: FileTextIcon,
      fields: [
        { key: 'posts_per_page', type: 'select', label: msg('Posts per page'), options: perPage, default: '20' },
        { key: 'sticky_sidebar', type: 'switch', label: msg('Sticky sidebar'), desc: msg('The sidebar stays in view while scrolling.'), default: 'false' },
        { key: 'rss_content', type: 'select', label: msg('RSS feed content'), options: [{ value: 'full', label: msg('Full text') }, { value: 'summary', label: msg('Summary only') }], default: 'full', desc: msg('Full text lets readers read the whole article in their feed reader. A summary sends only the excerpt, so they come to the site for the rest. The feed is at /rss.xml.') },
      ],
    },
    {
      id: 'comments', title: msg('Comments'), desc: msg('Who can comment, and how it is moderated.'), icon: MessageSquareIcon,
      fields: [
        { key: 'comments_enabled', type: 'switch', label: msg('Enable comments'), desc: msg('Allow visitors to leave comments.'), default: 'true' },
        { key: 'comments_require_name_email', type: 'switch', label: msg('Require name & email'), desc: msg('When off, visitors can comment anonymously.'), default: 'true' },
        { key: 'comments_auto_approve', type: 'switch', label: msg('Auto-approve'), desc: msg('Publish new comments without review.'), default: 'false' },
        { key: 'comments_close_after_days', type: 'select', label: msg('Close comments'), options: closeAfter, default: '30', desc: msg('Counted from the day the post was published.') },
      ],
    },
    {
      id: 'social', title: msg('Social'), desc: msg('Icons shown in the top bar.'), icon: Share2Icon,
      fields: [
        { key: 'social_facebook', type: 'url', label: 'Facebook', placeholder: 'https://facebook.com/yourpage', desc: msg('Leave empty to hide the icon.') },
        { key: 'social_twitter', type: 'url', label: 'X / Twitter', placeholder: 'https://x.com/yourhandle' },
        { key: 'social_instagram', type: 'url', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
        { key: 'social_youtube', type: 'url', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
      ],
    },
    {
      id: 'footer', title: msg('Footer'), desc: msg('Footer text and copyright.'), icon: PanelBottomIcon,
      fields: [
        { key: 'footer_description', type: 'textarea', label: msg('Footer description'), placeholder: msg('A few words about your publication...') },
        { key: 'footer_copyright_text', type: 'text', label: msg('Copyright text'), placeholder: '© 2026 My Website' },
      ],
    },
    {
      id: 'seo', title: 'SEO', desc: msg('Defaults for search engines and link previews.'), icon: SearchIcon,
      fields: [
        { key: 'search_engine_visible', type: 'switch', label: msg('Allow search engines'), desc: msg('When off, a "noindex" tag asks search engines not to list this site.'), default: 'true' },
        { key: 'default_meta_description', type: 'textarea', label: msg('Default meta description'), placeholder: msg('Describe your site for search engines...'), desc: msg('Up to 300 characters.') },
        { key: 'default_og_image', type: 'url', media: true, label: msg('Default share image'), placeholder: 'https://example.com/image.jpg', desc: msg('Shown when a page without its own image is shared.') },
        { key: 'robots_txt', type: 'textarea', label: 'robots.txt', mono: true, rows: 10, placeholder: msg('Leave empty to use the automatic robots.txt'), defaultText: (origin) => buildRobotsTxt(origin, false), desc: msg('Tells search engine crawlers what they may visit, served at /robots.txt. Empty uses the automatic file (blocks the admin, API and search results, and lists the sitemaps). Turning off "Allow search engines" above always blocks everything, whatever is written here.') },
      ],
    },
    {
      id: 'ads', title: msg('Ads'), desc: msg('Switch ads on or off and publish your ads.txt. The ads themselves are managed under Ads in the sidebar.'), icon: MegaphoneIcon,
      fields: [
        { key: 'ads_enabled', type: 'switch', label: msg('Show ads'), desc: msg('When off, no ad is shown anywhere on the public site.'), default: 'true' },
        { key: 'ads_txt', type: 'textarea', label: 'ads.txt', placeholder: 'google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0', desc: msg('Served at /ads.txt. One line per authorised seller; ad networks such as AdSense check it. Leave empty to serve nothing.') },
      ],
    },
  ]
}

export const SETTINGS_SECTION_IDS = [...buildSections().map(s => s.id), EMAIL_SECTION.id]

/** The URL of a section: General lives at the settings root, like Profile does in the reference template. */
export const settingsHref = (id: string) => (id === 'general' ? '/admin/settings' : `/admin/settings/${id}`)
