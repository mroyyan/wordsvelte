<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { toast } from 'svelte-sonner'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import * as Select from '$lib/components/ui/select'
  import Combobox from '$lib/components/admin/combobox.svelte'
  import { api, errorMessage } from '$lib/client/admin-api'
  import { buildSections, type Field } from '$lib/config/settings-sections'

  let { sectionId }: { sectionId: string } = $props()

  // the address the "Insert default" button writes into generated files (e.g. the Sitemap lines of robots.txt)
  const siteOrigin = $derived(($page.data.siteUrl as string | undefined) ?? '')

  let settings = $state<Record<string, string>>({})
  let initial = $state<Record<string, string>>({})
  let loading = $state(true)
  let saving = $state(false)
  let error = $state('')

  // Rebuilt from the current values: the date-format previews follow the chosen language and timezone.
  const section = $derived(buildSections(settings).find(s => s.id === sectionId)!)
  const dirtyKeys = $derived(section.fields.filter(f => (settings[f.key] ?? '') !== (initial[f.key] ?? '')).map(f => f.key))

  /** A stored value that is not in the list (older data) stays selectable instead of silently showing blank. */
  function optionsFor(field: Field) {
    const options = field.options ?? []
    const v = settings[field.key]
    return v && !options.some(o => o.value === v) ? [{ value: v, label: v }, ...options] : options
  }
  const labelOf = (field: Field) => optionsFor(field).find(o => o.value === settings[field.key])?.label ?? 'Select...'

  onMount(async () => {
    try {
      const data = await api<Record<string, string>>('/api/settings')
      const known: Record<string, string> = {}
      for (const f of buildSections(data).find(s => s.id === sectionId)!.fields) known[f.key] = data[f.key] ?? f.default ?? ''
      settings = { ...data, ...known }
      initial = { ...known }
    } catch (e) { error = errorMessage(e) } finally { loading = false }
  })

  async function save(e: Event) {
    e.preventDefault()
    if (!dirtyKeys.length) return
    saving = true; error = ''
    // Only this section's changed keys: never re-send others (e.g. the active theme) with possibly stale values.
    const body = Object.fromEntries(dirtyKeys.map(k => [k, settings[k] ?? '']))
    try {
      await api('/api/settings', { method: 'PUT', body })
      initial = { ...initial, ...body }
      toast.success(`${section.title} settings updated`)
    } catch (err) {
      error = errorMessage(err)
      toast.error(error)
    } finally { saving = false }
  }
</script>

{#if loading}
  <div class="space-y-8"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /></div>
{:else}
  <form onsubmit={save} class="space-y-5">
    {#each section.fields as field (field.key)}
      {#if field.type === 'switch'}
        <div class="flex flex-row items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5 pe-4">
            <Label for={field.key} class="text-base">{field.label}</Label>
            {#if field.desc}<p class="text-sm text-muted-foreground">{field.desc}</p>{/if}
          </div>
          <Switch id={field.key} checked={settings[field.key] === 'true'} onCheckedChange={(v) => (settings[field.key] = v ? 'true' : 'false')} />
        </div>
      {:else}
        <div class="space-y-2">
          <Label for={field.key}>{field.label}</Label>
          {#if field.type === 'textarea'}
            <Textarea id={field.key} bind:value={settings[field.key]} placeholder={field.placeholder} class="resize-y {field.mono ? 'font-mono text-xs' : ''}" rows={field.rows ?? 4} />
            {#if field.defaultText}
              <Button type="button" variant="outline" size="sm" onclick={() => (settings[field.key] = field.defaultText!(siteOrigin))}>Insert default</Button>
            {/if}
          {:else if field.type === 'select'}
            <Select.Root type="single" value={settings[field.key] ?? ''} onValueChange={(v) => (settings[field.key] = v)}>
              <Select.Trigger id={field.key} class="w-full">{labelOf(field)}</Select.Trigger>
              <Select.Content class="max-h-72">
                {#each optionsFor(field) as o (o.value)}<Select.Item value={o.value} label={o.label}>{o.label}</Select.Item>{/each}
              </Select.Content>
            </Select.Root>
          {:else if field.type === 'combobox'}
            <Combobox id={field.key} options={optionsFor(field)} bind:value={settings[field.key]} placeholder="Select a timezone" searchPlaceholder="Search timezones..." class="w-full" />
          {:else}
            <Input id={field.key} type={field.type} bind:value={settings[field.key]} placeholder={field.placeholder} />
          {/if}
          {#if field.desc}<p class="text-sm text-muted-foreground">{field.desc}</p>{/if}
        </div>
      {/if}
    {/each}

    {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}
    <Button type="submit" disabled={saving || !dirtyKeys.length}>
      {#if saving}<Loader2Icon class="animate-spin" />{/if}
      Update {section.title.toLowerCase()}
    </Button>
  </form>
{/if}
