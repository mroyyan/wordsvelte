<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import ImageIcon from '@lucide/svelte/icons/image'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import SaveIcon from '@lucide/svelte/icons/save'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Label } from '$lib/components/ui/label'
  import { Switch } from '$lib/components/ui/switch'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import * as Select from '$lib/components/ui/select'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import ScheduleField from '$lib/components/admin/schedule-field.svelte'
  import MediaLibrary from '$lib/components/admin/media/media-library.svelte'
  import { api, errorMessage } from '$lib/client/admin-api'
  import { AD_PLACEMENT_OPTIONS, AD_DEVICE_OPTIONS } from '$lib/config/ads'

  let { adId }: { adId?: number } = $props()

  // svelte-ignore state_referenced_locally (the id never changes for one form: the page re-creates it per ad)
  let loading = $state(!!adId)
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
  let active = $state(true)
  let sortOrder = $state('0')
  let clicks = $state(0)

  const labelOf = (list: { value: string; label: string }[], v: string) => list.find(o => o.value === v)?.label ?? 'Select...'

  onMount(async () => {
    if (!adId) return
    try {
      const ad = await api(`/api/ads/${adId}`)
      name = ad.name; placement = ad.placement; type = ad.type; imageUrl = ad.imageUrl ?? ''; linkUrl = ad.linkUrl ?? ''
      altText = ad.altText ?? ''; code = ad.code ?? ''; devices = ad.devices; startsAt = ad.startsAt ?? ''; endsAt = ad.endsAt ?? ''
      active = ad.status === 'active'; sortOrder = String(ad.sortOrder); clicks = ad.clicks
    } catch (e) { error = errorMessage(e) } finally { loading = false }
  })

  async function save(e: Event) {
    e.preventDefault()
    saving = true; error = ''
    const body = {
      name, placement, type, devices, status: active ? 'active' : 'paused', sortOrder: Number(sortOrder),
      startsAt: startsAt || null, endsAt: endsAt || null,
      ...(type === 'banner' ? { imageUrl, linkUrl, altText } : { code }),
    }
    try {
      await api(adId ? `/api/ads/${adId}` : '/api/ads', { method: adId ? 'PATCH' : 'POST', body })
      toast.success(adId ? 'Ad updated' : 'Ad created')
      await goto('/admin/ads')
    } catch (err) { error = errorMessage(err); toast.error(error) } finally { saving = false }
  }
</script>

<svelte:head><title>{adId ? 'Edit ad' : 'New ad'}</title></svelte:head>

<form onsubmit={save} class="flex flex-1 flex-col gap-4">
  <PageHeader title={adId ? 'Edit ad' : 'New ad'} description="Choose where it shows, what it shows and when it runs.">
    {#snippet actions()}
      <Button type="button" variant="ghost" onclick={() => goto('/admin/ads')}>Cancel</Button>
      <Button type="submit" disabled={saving || loading}>
        {#if saving}<Loader2Icon class="animate-spin" />{:else}<SaveIcon />{/if}
        {adId ? 'Update ad' : 'Create ad'}
      </Button>
    {/snippet}
  </PageHeader>

  {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}

  {#if loading}
    <div class="max-w-2xl space-y-6"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /><Skeleton class="h-40 w-full" /></div>
  {:else}
    <div class="max-w-2xl space-y-6">
      <div class="space-y-2">
        <Label for="ad-name">Name</Label>
        <Input id="ad-name" bind:value={name} required maxlength={100} placeholder="e.g. Sponsor banner October" />
        <p class="text-sm text-muted-foreground">Only for you, to tell ads apart. Visitors never see it.</p>
      </div>

      <div class="space-y-2">
        <Label for="ad-placement">Placement</Label>
        <Select.Root type="single" value={placement} onValueChange={(v) => (placement = v)}>
          <Select.Trigger id="ad-placement" class="w-full">{labelOf(AD_PLACEMENT_OPTIONS, placement)}</Select.Trigger>
          <Select.Content>
            {#each AD_PLACEMENT_OPTIONS as o (o.value)}<Select.Item value={o.value} label={o.label}>{o.label}</Select.Item>{/each}
          </Select.Content>
        </Select.Root>
        <p class="text-sm text-muted-foreground">Several ads in the same place are shown one under the other, lowest order first.</p>
      </div>

      <div class="space-y-2">
        <Label>Type</Label>
        <div class="flex gap-2" role="radiogroup" aria-label="Ad type">
          <Button type="button" role="radio" aria-checked={type === 'banner'} variant={type === 'banner' ? 'default' : 'outline'} onclick={() => (type = 'banner')}>Banner (image and link)</Button>
          <Button type="button" role="radio" aria-checked={type === 'code'} variant={type === 'code' ? 'default' : 'outline'} onclick={() => (type = 'code')}>Ad code (AdSense, ...)</Button>
        </div>
      </div>

      {#if type === 'banner'}
        <div class="space-y-2">
          <Label for="ad-image">Image</Label>
          <div class="flex gap-2">
            <Input id="ad-image" bind:value={imageUrl} placeholder="https://... or choose from the media library" class="min-w-0 flex-1" />
            <Button type="button" variant="outline" onclick={() => (showLibrary = true)}><ImageIcon /> Browse</Button>
          </div>
          {#if imageUrl}<img src={imageUrl} alt="" class="mt-2 max-h-40 rounded-md border object-contain" />{/if}
        </div>
        <div class="space-y-2">
          <Label for="ad-link">Link</Label>
          <Input id="ad-link" type="url" bind:value={linkUrl} placeholder="https://advertiser.example/landing" />
          <p class="text-sm text-muted-foreground">Visitors go here when they click. Clicks are counted and the link is marked as sponsored.</p>
        </div>
        <div class="space-y-2">
          <Label for="ad-alt">Image description</Label>
          <Input id="ad-alt" bind:value={altText} maxlength={150} placeholder="Short text for screen readers" />
        </div>
        <MediaLibrary bind:open={showLibrary} onSelect={(url: string) => (imageUrl = url)} />
      {:else}
        <div class="space-y-2">
          <Label for="ad-code">Ad code</Label>
          <Textarea id="ad-code" bind:value={code} rows={9} class="font-mono text-xs" placeholder="Paste the code from your ad network here" />
          <p class="text-sm text-muted-foreground">Pasted exactly as the ad network gives it, scripts included. It runs on every page where it is shown, so only paste code you trust.</p>
        </div>
      {/if}

      <div class="space-y-2">
        <Label for="ad-devices">Show on</Label>
        <Select.Root type="single" value={devices} onValueChange={(v) => (devices = v)}>
          <Select.Trigger id="ad-devices" class="w-full">{labelOf(AD_DEVICE_OPTIONS, devices)}</Select.Trigger>
          <Select.Content>
            {#each AD_DEVICE_OPTIONS as o (o.value)}<Select.Item value={o.value} label={o.label}>{o.label}</Select.Item>{/each}
          </Select.Content>
        </Select.Root>
      </div>

      <div class="grid gap-6 sm:grid-cols-2">
        <ScheduleField id="ad-start" bind:value={startsAt} label="Starts" verb="Starts" allowPast clearable />
        <ScheduleField id="ad-end" bind:value={endsAt} label="Ends" verb="Ends" allowPast clearable />
      </div>
      <p class="-mt-3 text-sm text-muted-foreground">Leave a date empty for no limit on that side.</p>

      <div class="grid gap-6 sm:grid-cols-2">
        <div class="space-y-2">
          <Label for="ad-order">Order</Label>
          <Input id="ad-order" type="number" min="0" max="9999" bind:value={sortOrder} />
        </div>
        <div class="flex items-center justify-between gap-4 rounded-lg border p-4 sm:self-end">
          <div class="space-y-0.5">
            <Label for="ad-active" class="text-base">Active</Label>
            <p class="text-sm text-muted-foreground">Pause to hide it without deleting.</p>
          </div>
          <Switch id="ad-active" checked={active} onCheckedChange={(v) => (active = v)} />
        </div>
      </div>

      {#if adId}<p class="text-sm text-muted-foreground">{clicks} click{clicks === 1 ? '' : 's'} so far.</p>{/if}
    </div>
  {/if}
</form>
