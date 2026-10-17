<script lang="ts">
  import { mode, setMode } from 'mode-watcher'
  import { page } from '$app/state'
  import { invalidateAll } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import * as Select from '$lib/components/ui/select'
  import { api, errorMessage } from '$lib/client/admin-api'
  import { LANGUAGES } from '$lib/shared/format-date'
  import { tr } from '$lib/i18n/admin'
  import { cn } from '$lib/utils'
  import ContentSection from '$lib/components/settings/content-section.svelte'

  const choose = (v: 'light' | 'dark') => setMode(v)

  // '' means "follow the site language"
  const current = $derived((page.data.user?.language as string | null | undefined) ?? '')
  const languageLabel = $derived(current ? (LANGUAGES.find(l => l.value === current)?.label ?? current) : tr('Follow the site language'))
  let savingLanguage = $state(false)

  async function setLanguage(value: string) {
    savingLanguage = true
    try {
      await api('/api/account', { method: 'PATCH', body: { language: value || null } })
      // the admin layout holds the user: reload it so every screen switches language at once
      await invalidateAll()
      toast.success(tr('Language updated'))
    } catch (e) { toast.error(errorMessage(e)) } finally { savingLanguage = false }
  }
</script>

<svelte:head><title>{tr('Appearance - Profile')}</title></svelte:head>

<ContentSection title={tr('Appearance')} desc={tr('Customize how the dashboard looks. Automatically switch between day and night themes.')}>
  <div class="mb-8 space-y-2">
    <p class="text-sm leading-none font-medium" id="admin-language-label">{tr('Language')}</p>
    <p class="text-sm text-muted-foreground">{tr('The language of this admin panel, only for you. The public site keeps the language set in Settings.')}</p>
    <Select.Root type="single" value={current} onValueChange={setLanguage} disabled={savingLanguage}>
      <Select.Trigger class="w-full max-w-xs" aria-labelledby="admin-language-label">{languageLabel}</Select.Trigger>
      <Select.Content>
        <Select.Item value="" label={tr('Follow the site language')}>{tr('Follow the site language')}</Select.Item>
        {#each LANGUAGES as l (l.value)}<Select.Item value={l.value} label={l.label}>{l.label}</Select.Item>{/each}
      </Select.Content>
    </Select.Root>
  </div>

  <div class="space-y-2">
    <p class="text-sm leading-none font-medium">{tr('Theme')}</p>
    <p class="text-sm text-muted-foreground">{tr('Select the theme for the dashboard.')}</p>
    <div class="grid max-w-md grid-cols-2 gap-8 pt-2" role="radiogroup" aria-label={tr('Theme')}>
      <button type="button" role="radio" aria-checked={mode.current === 'light'} onclick={() => choose('light')} class="text-start">
        <div class={cn('items-center rounded-md border-2 border-muted p-1 hover:border-accent', mode.current === 'light' && 'border-primary')}>
          <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
            <div class="space-y-2 rounded-md bg-white p-2 shadow-xs">
              <div class="h-2 w-20 rounded-lg bg-[#ecedef]"></div>
              <div class="h-2 w-24 rounded-lg bg-[#ecedef]"></div>
            </div>
            <div class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
              <div class="size-4 rounded-full bg-[#ecedef]"></div>
              <div class="h-2 w-24 rounded-lg bg-[#ecedef]"></div>
            </div>
            <div class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
              <div class="size-4 rounded-full bg-[#ecedef]"></div>
              <div class="h-2 w-24 rounded-lg bg-[#ecedef]"></div>
            </div>
          </div>
        </div>
        <span class="block w-full p-2 text-center text-sm font-normal">{tr('Light')}</span>
      </button>

      <button type="button" role="radio" aria-checked={mode.current === 'dark'} onclick={() => choose('dark')} class="text-start">
        <div class={cn('items-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground', mode.current === 'dark' && 'border-primary')}>
          <div class="space-y-2 rounded-sm bg-slate-950 p-2">
            <div class="space-y-2 rounded-md bg-slate-800 p-2 shadow-xs">
              <div class="h-2 w-20 rounded-lg bg-slate-400"></div>
              <div class="h-2 w-24 rounded-lg bg-slate-400"></div>
            </div>
            <div class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
              <div class="size-4 rounded-full bg-slate-400"></div>
              <div class="h-2 w-24 rounded-lg bg-slate-400"></div>
            </div>
            <div class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
              <div class="size-4 rounded-full bg-slate-400"></div>
              <div class="h-2 w-24 rounded-lg bg-slate-400"></div>
            </div>
          </div>
        </div>
        <span class="block w-full p-2 text-center text-sm font-normal">{tr('Dark')}</span>
      </button>
    </div>
  </div>
</ContentSection>
