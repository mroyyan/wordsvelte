<script lang="ts">
  import { page as route } from '$app/stores'
  import { onMount } from 'svelte'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import PageForm from '$lib/components/admin/page-form.svelte'
  import { tr } from '$lib/i18n/admin'

  let record = $state<any | null>(null)
  let error = $state('')

  onMount(async () => {
    try {
      const res = await fetch(`/api/pages/${$route.params.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('wordsvelte_token')}` } })
      const json = await res.json()
      if (!json.success) error = json.error || tr('Page not found')
      else record = json.data
    } catch (e: any) { error = e.message }
  })
</script>

<svelte:head><title>{tr('Edit page')}</title></svelte:head>

<PageHeader title={tr('Edit Page')} />
{#if error}
  <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
{:else if !record}
  <div class="flex justify-center py-12"><Loader2Icon class="size-5 animate-spin text-muted-foreground" /></div>
{:else}
  <PageForm page={record} />
{/if}
