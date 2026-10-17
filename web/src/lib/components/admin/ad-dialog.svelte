<script lang="ts">
  import { toast } from 'svelte-sonner'
  import ImageIcon from '@lucide/svelte/icons/image'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Label } from '$lib/components/ui/label'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import * as Select from '$lib/components/ui/select'
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog'
  import ScheduleField from '$lib/components/admin/schedule-field.svelte'
  import MediaLibrary from '$lib/components/admin/media/media-library.svelte'
  import { api, errorMessage } from '$lib/client/admin-api'
  import { AD_PLACEMENT_OPTIONS, AD_DEVICE_OPTIONS } from '$lib/config/ads'
  import { tr, msg } from '$lib/i18n/admin'

  /** Create an ad (adId null) or edit one. `onsaved` runs after a successful save so the list can reload. */
  let { open = $bindable(false), adId = null, onsaved }: { open?: boolean; adId?: number | null; onsaved?: () => void } = $props()

  let loading = $state(false)
  let saving = $state(false)
  let error = $state('')
  let showLibrary = $state(false)

  let name = $state('')
  let placement = $state('sidebar-top')
  let type = $state<'banner' | 'code'>('banner')
  let imageUrl = $state('')
  let linkUrl = $state('')
  let altText = $state('')
  let code = $state('')
  let devices = $state('all')
  let startsAt = $state('')
  let endsAt = $state('')
  let clicks = $state(0)

  const labelOf = (list: { value: string; label: string }[], v: string) => { const o = list.find(o => o.value === v); return o ? tr(o.label) : tr('Select...') }

  function reset() {
    name = ''; placement = 'sidebar-top'; type = 'banner'; imageUrl = ''; linkUrl = ''; altText = ''; code = ''
    devices = 'all'; startsAt = ''; endsAt = ''; clicks = 0; error = ''
  }

  // Every time the dialog opens: start blank, or load the ad being edited.
  $effect(() => {
    if (!open) return
    reset()
    if (adId === null) return
    loading = true
    api(`/api/ads/${adId}`)
      .then((ad) => {
        name = ad.name; placement = ad.placement; type = ad.type; imageUrl = ad.imageUrl ?? ''; linkUrl = ad.linkUrl ?? ''
        altText = ad.altText ?? ''; code = ad.code ?? ''; devices = ad.devices; startsAt = ad.startsAt ?? ''; endsAt = ad.endsAt ?? ''
        clicks = ad.clicks
      })
      .catch((e) => { error = errorMessage(e) })
      .finally(() => { loading = false })
  })

  async function save(e: Event) {
    e.preventDefault()
    saving = true; error = ''
    const body = {
      // status (enable / disable) is switched from the list; order and status are left as they are when editing
      name, placement, type, devices,
      startsAt: startsAt || null, endsAt: endsAt || null,
      ...(type === 'banner' ? { imageUrl, linkUrl, altText } : { code }),
    }
    try {
      await api(adId === null ? '/api/ads' : `/api/ads/${adId}`, { method: adId === null ? 'POST' : 'PATCH', body })
      toast.success(adId === null ? tr('Ad created') : tr('Ad updated'))
      open = false
      onsaved?.()
    } catch (err) { error = errorMessage(err) } finally { saving = false }
  }
</script>

<Dialog bind:open>
  <DialogContent class="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-xl">
    <DialogHeader class="border-b p-4 pe-12">
      <DialogTitle>{adId === null ? tr('New ad') : tr('Edit ad')}</DialogTitle>
      <DialogDescription>{tr('Choose where it shows, what it shows and when it runs.')}</DialogDescription>
    </DialogHeader>

    <form id="ad-form" onsubmit={save} class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}

      {#if loading}
        <Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /><Skeleton class="h-32 w-full" />
      {:else}
        <div class="space-y-2">
          <Label for="ad-name">{tr('Name')}</Label>
          <Input id="ad-name" bind:value={name} required maxlength={100} placeholder={tr('e.g. Sponsor banner October')} />
          <p class="text-sm text-muted-foreground">{tr('Only for you, to tell ads apart.')}</p>
        </div>

        <div class="space-y-2">
          <Label for="ad-placement">{tr('Placement')}</Label>
          <Select.Root type="single" value={placement} onValueChange={(v) => (placement = v)}>
            <Select.Trigger id="ad-placement" class="w-full">{labelOf(AD_PLACEMENT_OPTIONS, placement)}</Select.Trigger>
            <Select.Content>
              {#each AD_PLACEMENT_OPTIONS as o (o.value)}<Select.Item value={o.value} label={tr(o.label)}>{tr(o.label)}</Select.Item>{/each}
            </Select.Content>
          </Select.Root>
          <p class="text-sm text-muted-foreground">{tr('Several ads in one place are shown one under the other.')}</p>
        </div>

        <div class="space-y-2">
          <Label>{tr('Type')}</Label>
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label={tr('Ad type')}>
            <Button type="button" role="radio" aria-checked={type === 'banner'} variant={type === 'banner' ? 'default' : 'outline'} onclick={() => (type = 'banner')}>{tr('Banner')}</Button>
            <Button type="button" role="radio" aria-checked={type === 'code'} variant={type === 'code' ? 'default' : 'outline'} onclick={() => (type = 'code')}>{tr('Ad code (AdSense, ...)')}</Button>
          </div>
        </div>

        {#if type === 'banner'}
          <div class="space-y-2">
            <Label for="ad-image">{tr('Image')}</Label>
            <div class="flex gap-2">
              <Input id="ad-image" bind:value={imageUrl} placeholder={tr('https://... or from the media library')} class="min-w-0 flex-1" />
              <Button type="button" variant="outline" class="h-8" onclick={() => (showLibrary = true)}><ImageIcon /> {tr('Browse')}</Button>
            </div>
            {#if imageUrl}<img src={imageUrl} alt="" class="mt-2 max-h-32 rounded-md border object-contain" />{/if}
          </div>
          <div class="space-y-2">
            <Label for="ad-link">{tr('Link')}</Label>
            <Input id="ad-link" type="url" bind:value={linkUrl} placeholder="https://advertiser.example/landing" />
            <p class="text-sm text-muted-foreground">{tr('Where a click goes. Clicks are counted and the link is marked as sponsored.')}</p>
          </div>
          <div class="space-y-2">
            <Label for="ad-alt">{tr('Image description')}</Label>
            <Input id="ad-alt" bind:value={altText} maxlength={150} placeholder={tr('Short text for screen readers')} />
          </div>
        {:else}
          <div class="space-y-2">
            <Label for="ad-code">{tr('Ad code')}</Label>
            <Textarea id="ad-code" bind:value={code} rows={7} class="font-mono text-xs" placeholder={tr('Paste the code from your ad network here')} />
            <p class="text-sm text-muted-foreground">{tr('Used exactly as pasted, scripts included. It runs on every page where it shows, so only paste code you trust.')}</p>
          </div>
        {/if}

        <div class="space-y-2">
          <Label for="ad-devices">{tr('Show on')}</Label>
          <Select.Root type="single" value={devices} onValueChange={(v) => (devices = v)}>
            <Select.Trigger id="ad-devices" class="w-full">{labelOf(AD_DEVICE_OPTIONS, devices)}</Select.Trigger>
            <Select.Content>
              {#each AD_DEVICE_OPTIONS as o (o.value)}<Select.Item value={o.value} label={tr(o.label)}>{tr(o.label)}</Select.Item>{/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <ScheduleField id="ad-start" bind:value={startsAt} label={msg('Starts')} verb={msg('Starts')} allowPast clearable />
          <ScheduleField id="ad-end" bind:value={endsAt} label={msg('Ends')} verb={msg('Ends')} allowPast clearable />
        </div>
        <p class="-mt-3 text-sm text-muted-foreground">{tr('Leave a date empty for no limit on that side.')}</p>

        {#if adId !== null}<p class="text-sm text-muted-foreground">{clicks === 1 ? tr('1 click so far.') : tr('{n} clicks so far.', { n: clicks })}</p>{/if}
      {/if}
    </form>

    <DialogFooter class="mx-0 mb-0 p-4">
      <Button type="button" variant="ghost" onclick={() => (open = false)}>{tr('Cancel')}</Button>
      <Button type="submit" form="ad-form" disabled={saving || loading}>
        {#if saving}<Loader2Icon class="animate-spin" />{/if}
        {adId === null ? tr('Create ad') : tr('Update ad')}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<MediaLibrary bind:open={showLibrary} onSelect={(url: string) => (imageUrl = url)} />
