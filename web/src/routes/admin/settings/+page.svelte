<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import SaveIcon from '@lucide/svelte/icons/save'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import GlobeIcon from '@lucide/svelte/icons/globe'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import MessageSquareIcon from '@lucide/svelte/icons/message-square'
  import Share2Icon from '@lucide/svelte/icons/share-2'
  import PanelBottomIcon from '@lucide/svelte/icons/panel-bottom'
  import SearchIcon from '@lucide/svelte/icons/search'
  import MailIcon from '@lucide/svelte/icons/mail'
  import type { Component } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import * as Select from '$lib/components/ui/select'
  import { Card, CardContent } from '$lib/components/ui/card'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import Combobox from '$lib/components/admin/combobox.svelte'
  import SmtpSettings from '$lib/components/admin/smtp-settings.svelte'
  import { api, errorMessage } from '$lib/admin-api'
  import { DATE_FORMATS, DEFAULT_TIMEZONE, LANGUAGES, formatDateWith } from '$lib/format-date'

  type Option = { value: string; label: string }
  type Field = {
    key: string
    label: string
    type: 'text' | 'email' | 'url' | 'textarea' | 'select' | 'combobox' | 'switch'
    placeholder?: string
    desc?: string
    default?: string
    options?: Option[]
    width?: string
  }
  type Section = { id: string; title: string; desc: string; icon: Component<any>; fields: Field[] }

  // ---- option lists ----
  const PRIORITY_ZONES = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak']
  function timezoneOptions(): Option[] {
    let all: string[] = []
    try { all = (Intl as any).supportedValuesOf('timeZone') } catch { /* very old runtime */ }
    const rest = all.filter(z => !PRIORITY_ZONES.includes(z))
    return [...PRIORITY_ZONES, 'UTC', ...rest.filter(z => z !== 'UTC')].map(z => ({ value: z, label: z.replaceAll('_', ' ') }))
  }
  const zones = timezoneOptions()

  const perPage: Option[] = [5, 10, 12, 15, 20, 25, 30, 40, 50].map(n => ({ value: String(n), label: `${n} posts` }))
  const closeAfter: Option[] = [
    { value: '0', label: 'Never close' },
    { value: '7', label: 'After 1 week' },
    { value: '14', label: 'After 2 weeks' },
    { value: '30', label: 'After 1 month' },
    { value: '60', label: 'After 2 months' },
    { value: '90', label: 'After 3 months' },
    { value: '180', label: 'After 6 months' },
    { value: '365', label: 'After 1 year' },
  ]

  let settings = $state<Record<string, string>>({})
  let initial = $state<Record<string, string>>({})
  let loading = $state(true)
  let saving = $state(false)
  let error = $state('')
  let activeTab = $state('general')

  // a sample to render the date-format previews with: right now, in the chosen language and timezone
  const sample = new Date().toISOString()
  const dateFormatOptions = $derived<Option[]>(DATE_FORMATS.map(f => ({
    value: f,
    label: `${formatDateWith(sample, { date_format: f, language: settings.language, timezone: settings.timezone })}   (${f})`,
  })))

  const sections: Section[] = $derived([
    {
      id: 'general', title: 'General', desc: 'Site title, tagline and regional settings', icon: GlobeIcon,
      fields: [
        { key: 'site_name', type: 'text', label: 'Site title', placeholder: 'My Website' },
        { key: 'site_url', type: 'url', label: 'Site URL', placeholder: 'https://news.example.com', desc: 'Your main address, used for canonical links, sitemaps, share cards and the RSS feed. Leave empty to detect it automatically.' },
        { key: 'site_description', type: 'textarea', label: 'Tagline', placeholder: 'A short description of your site' },
        { key: 'admin_email', type: 'email', label: 'Admin email', placeholder: 'admin@example.com', desc: 'Only visible to administrators.' },
        { key: 'language', type: 'select', label: 'Language', options: LANGUAGES.map(l => ({ value: l.value, label: l.label })), default: 'id', desc: 'Used for month and day names on the site.' },
        { key: 'timezone', type: 'combobox', label: 'Timezone', options: zones, default: DEFAULT_TIMEZONE, desc: 'Publication dates are shown in this timezone.' },
        { key: 'date_format', type: 'select', label: 'Date format', options: dateFormatOptions, default: 'd F Y', desc: 'How dates appear on articles and lists.' },
      ],
    },
    {
      id: 'reading', title: 'Reading', desc: 'How posts are listed and found', icon: FileTextIcon,
      fields: [
        { key: 'posts_per_page', type: 'select', label: 'Posts per page', options: perPage, default: '20' },
        { key: 'search_engine_visible', type: 'switch', label: 'Allow search engines', desc: 'When off, a "noindex" tag asks search engines not to list this site.', default: 'true' },
        { key: 'sticky_sidebar', type: 'switch', label: 'Sticky sidebar', desc: 'The sidebar stays in view while scrolling.', default: 'false' },
      ],
    },
    {
      id: 'comments', title: 'Comments', desc: 'Who can comment, and how it is moderated', icon: MessageSquareIcon,
      fields: [
        { key: 'comments_enabled', type: 'switch', label: 'Enable comments', desc: 'Allow visitors to leave comments.', default: 'true' },
        { key: 'comments_auto_approve', type: 'switch', label: 'Auto-approve', desc: 'Publish new comments without review.', default: 'false' },
        { key: 'comments_require_name_email', type: 'switch', label: 'Require name & email', desc: 'When off, visitors can comment anonymously.', default: 'true' },
        { key: 'comments_close_after_days', type: 'select', label: 'Close comments', options: closeAfter, default: '30', desc: 'Counted from the day the post was published.' },
      ],
    },
    {
      id: 'social', title: 'Social', desc: 'Icons shown in the top bar', icon: Share2Icon,
      fields: [
        { key: 'social_facebook', type: 'url', label: 'Facebook', placeholder: 'https://facebook.com/yourpage', desc: 'Leave empty to hide the icon.' },
        { key: 'social_twitter', type: 'url', label: 'X / Twitter', placeholder: 'https://x.com/yourhandle' },
        { key: 'social_instagram', type: 'url', label: 'Instagram', placeholder: 'https://instagram.com/yourhandle' },
        { key: 'social_youtube', type: 'url', label: 'YouTube', placeholder: 'https://youtube.com/@yourchannel' },
      ],
    },
    {
      id: 'footer', title: 'Footer', desc: 'Footer text and copyright', icon: PanelBottomIcon,
      fields: [
        { key: 'footer_copyright_text', type: 'text', label: 'Copyright text', placeholder: '© 2026 My Website' },
        { key: 'footer_description', type: 'textarea', label: 'Footer description', placeholder: 'A few words about your publication...' },
      ],
    },
    {
      id: 'seo', title: 'SEO', desc: 'Defaults for search engines and link previews', icon: SearchIcon,
      fields: [
        { key: 'default_meta_description', type: 'textarea', label: 'Default meta description', placeholder: 'Describe your site for search engines...', desc: 'Up to 300 characters.' },
        { key: 'default_og_image', type: 'url', label: 'Default share image', placeholder: 'https://example.com/image.jpg', desc: 'Shown when a page without its own image is shared.' },
      ],
    },
  ])

  // The Email tab saves through its own endpoint (it holds an encrypted password), so it is not one of the form's sections.
  const tabs = $derived([...sections, { id: 'email', title: 'Email', icon: MailIcon }])

  const allFields = $derived(sections.flatMap(s => s.fields))
  const active = $derived(sections.find(s => s.id === activeTab) ?? sections[0])
  const dirtyKeys = $derived(allFields.filter(f => (settings[f.key] ?? '') !== (initial[f.key] ?? '')).map(f => f.key))
  const dirty = $derived(dirtyKeys.length > 0)
  const dirtySections = $derived(new Set(sections.filter(s => s.fields.some(f => dirtyKeys.includes(f.key))).map(s => s.id)))

  /** A stored value that is not in the list (older data) stays selectable instead of silently showing blank. */
  function optionsFor(field: Field): Option[] {
    const options = field.options ?? []
    const v = settings[field.key]
    return v && !options.some(o => o.value === v) ? [{ value: v, label: v }, ...options] : options
  }
  const labelOf = (field: Field) => optionsFor(field).find(o => o.value === settings[field.key])?.label ?? 'Select...'

  onMount(async () => {
    try {
      const data = await api<Record<string, string>>('/api/settings')
      const known: Record<string, string> = {}
      for (const f of allFields) known[f.key] = data[f.key] ?? f.default ?? ''
      settings = { ...data, ...known }
      initial = { ...known }
    } catch (e) { error = errorMessage(e) } finally { loading = false }
  })

  async function save(e: Event) {
    e.preventDefault()
    if (!dirty) return
    saving = true; error = ''
    // Only the settings this screen manages: never re-send others (e.g. the active theme) with possibly stale values.
    const body = Object.fromEntries(dirtyKeys.map(k => [k, settings[k] ?? '']))
    try {
      await api('/api/settings', { method: 'PUT', body })
      initial = { ...initial, ...body }
      toast.success('Settings saved')
    } catch (err) {
      error = errorMessage(err)
      toast.error(error)
    } finally { saving = false }
  }

  function discard() { settings = { ...settings, ...initial }; error = '' }
</script>

<svelte:head><title>Settings</title></svelte:head>

<form id="settings-form" onsubmit={save} class="flex flex-1 flex-col gap-4">
  <PageHeader title="Settings" description="Site configuration">
    {#snippet actions()}
      {#if dirty}<Button type="button" variant="ghost" onclick={discard}>Discard</Button>{/if}
      <Button type="submit" disabled={saving || !dirty}>
        {#if saving}<Loader2Icon class="animate-spin" />{:else}<SaveIcon />{/if}
        {saving ? 'Saving...' : dirty ? `Save changes (${dirtyKeys.length})` : 'Saved'}
      </Button>
    {/snippet}
  </PageHeader>

  {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}

  {#if loading}
    <div class="grid gap-4"><Skeleton class="h-10 w-full max-w-xl" /><Skeleton class="h-96 w-full max-w-2xl rounded-xl" /></div>
  {:else}
    <div class="flex gap-1 overflow-x-auto border-b" role="tablist">
      {#each tabs as section (section.id)}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === section.id}
          onclick={() => (activeTab = section.id)}
          class="flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors {activeTab === section.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
        >
          <section.icon class="size-4" />
          {section.title}
          {#if dirtySections.has(section.id)}<span class="size-1.5 rounded-full bg-amber-500" title="Unsaved changes"></span>{/if}
        </button>
      {/each}
    </div>

    {#if activeTab === 'email'}
      <SmtpSettings />
    {:else}
    <div class="max-w-2xl space-y-3">
      <p class="text-sm text-muted-foreground">{active.desc}</p>
      <Card>
        <CardContent class="space-y-5">
          {#each active.fields as field (field.key)}
            {#if field.type === 'switch'}
              <div class="flex items-center justify-between gap-4">
                <div class="space-y-0.5">
                  <Label for={field.key}>{field.label}</Label>
                  {#if field.desc}<p class="text-xs text-muted-foreground">{field.desc}</p>{/if}
                </div>
                <Switch id={field.key} checked={settings[field.key] === 'true'} onCheckedChange={(v) => (settings[field.key] = v ? 'true' : 'false')} />
              </div>
            {:else}
              <div class="space-y-1.5">
                <Label for={field.key}>{field.label}</Label>
                {#if field.type === 'textarea'}
                  <Textarea id={field.key} bind:value={settings[field.key]} placeholder={field.placeholder} class="min-h-[100px]" />
                {:else if field.type === 'select'}
                  <Select.Root type="single" value={settings[field.key] ?? ''} onValueChange={(v) => (settings[field.key] = v)}>
                    <Select.Trigger id={field.key} class="w-full max-w-sm">{labelOf(field)}</Select.Trigger>
                    <Select.Content class="max-h-72">
                      {#each optionsFor(field) as o (o.value)}<Select.Item value={o.value} label={o.label}>{o.label}</Select.Item>{/each}
                    </Select.Content>
                  </Select.Root>
                {:else if field.type === 'combobox'}
                  <Combobox id={field.key} options={optionsFor(field)} bind:value={settings[field.key]} placeholder="Select a timezone" searchPlaceholder="Search timezones..." class="max-w-sm" />
                {:else}
                  <Input id={field.key} type={field.type} bind:value={settings[field.key]} placeholder={field.placeholder} />
                {/if}
                {#if field.desc}<p class="text-xs text-muted-foreground">{field.desc}</p>{/if}
              </div>
            {/if}
          {/each}
        </CardContent>
      </Card>
    </div>
    {/if}
  {/if}
</form>
