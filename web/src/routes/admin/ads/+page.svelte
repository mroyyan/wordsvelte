<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import MegaphoneIcon from '@lucide/svelte/icons/megaphone'
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import PlayIcon from '@lucide/svelte/icons/play'
  import PauseIcon from '@lucide/svelte/icons/pause'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu'
  import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  } from '$lib/components/ui/alert-dialog'
  import AdDialog from '$lib/components/admin/ad-dialog.svelte'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import PrimaryButton from '$lib/components/layout/primary-button.svelte'
  import {
    DataTableState, DataTableToolbar, DataTableFacetedFilter, DataTableColumnHeader, DataTablePagination, DataTableBulkActions,
  } from '$lib/components/data-table'
  import { api, errorMessage, runBulk } from '$lib/client/admin-api'
  import { AD_PLACEMENT_OPTIONS } from '$lib/config/ads'
  import { tr, msg, formatAdminDate } from '$lib/i18n/admin'

  interface AdRow {
    id: number; name: string; placement: string; type: 'banner' | 'code'; devices: string
    status: 'active' | 'paused'; startsAt: string | null; endsAt: string | null; clicks: number
  }

  const placementLabel = (v: string) => tr(AD_PLACEMENT_OPTIONS.find(o => o.value === v)?.label ?? v)
  const statusOptions = $derived([{ label: tr('Running'), value: 'running' }, { label: tr('Scheduled'), value: 'scheduled' }, { label: tr('Ended'), value: 'ended' }, { label: tr('Disabled'), value: 'paused' }])
  const typeOptions = $derived([{ label: tr('Banner'), value: 'banner' }, { label: tr('Ad code'), value: 'code' }])
  const stateColors: Record<string, string> = {
    running: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    scheduled: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
    ended: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    paused: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900',
  }

  /** What an advertiser would call it: paused wins, otherwise it depends on where "now" falls in the run window. */
  function stateOf(ad: AdRow): 'running' | 'scheduled' | 'ended' | 'paused' {
    if (ad.status === 'paused') return 'paused'
    const now = Date.now()
    if (ad.startsAt && Date.parse(ad.startsAt) > now) return 'scheduled'
    if (ad.endsAt && Date.parse(ad.endsAt) <= now) return 'ended'
    return 'running'
  }
  const stateLabel = (ad: AdRow) => statusOptions.find(o => o.value === stateOf(ad))!.label

  const columns = $derived([
    { id: 'name', title: tr('Name') },
    { id: 'placement', title: tr('Placement'), secondary: true },
    { id: 'type', title: tr('Type'), secondary: true },
    { id: 'state', title: tr('Status'), secondary: true },
    { id: 'clicks', title: tr('Clicks'), secondary: true },
  ])

  const table = new DataTableState<AdRow>({
    getId: a => a.id,
    searchFields: [a => a.name, a => placementLabel(a.placement)],
    filterAccessors: { state: a => stateOf(a), type: a => a.type },
    sortAccessors: { name: a => a.name, placement: a => a.placement, type: a => a.type, state: a => stateOf(a), clicks: a => a.clicks },
  })

  let loading = $state(true)
  let error = $state('')
  let busy = $state(false)
  let deleting = $state<AdRow[] | null>(null)
  let dialogOpen = $state(false)
  let editingId = $state<number | null>(null)
  const openCreate = () => { editingId = null; dialogOpen = true }
  const openEdit = (id: number) => { editingId = id; dialogOpen = true }
  const visibleColumns = $derived(columns.filter(c => table.isVisible(c.id)))

  async function load() {
    loading = true; error = ''
    try { table.setRows(await api<AdRow[]>('/api/ads')) }
    catch (e) { error = errorMessage(e) } finally { loading = false }
  }
  onMount(load)

  async function setStatus(rows: AdRow[], status: AdRow['status']) {
    busy = true
    const { ok, failed, firstError } = await runBulk(rows, r => api(`/api/ads/${r.id}`, { method: 'PATCH', body: { status } }))
    await load(); table.clearSelection(); busy = false
    if (failed) toast.error(tr('{ok} updated, {failed} failed: {error}', { ok, failed, error: firstError ?? '' }))
    else if (status === 'active') toast.success(ok === 1 ? tr('1 ad enabled') : tr('{n} ads enabled', { n: ok }))
    else toast.success(ok === 1 ? tr('1 ad disabled') : tr('{n} ads disabled', { n: ok }))
  }

  async function confirmDelete() {
    const targets = deleting
    if (!targets) return
    deleting = null; busy = true
    const { ok, failed, firstError } = await runBulk(targets, r => api(`/api/ads/${r.id}`, { method: 'DELETE' }))
    await load(); table.clearSelection(); busy = false
    if (failed) toast.error(tr('{ok} deleted, {failed} failed: {error}', { ok, failed, error: firstError ?? '' }))
    else toast.success(ok === 1 ? tr('1 ad deleted') : tr('{n} ads deleted', { n: ok }))
  }

  const runWindow = (ad: AdRow) => (ad.startsAt || ad.endsAt
    ? tr('{from} to {to}', { from: ad.startsAt ? formatAdminDate(ad.startsAt) : tr('now'), to: ad.endsAt ? formatAdminDate(ad.endsAt) : tr('no end') })
    : tr('No time limit'))
</script>

<svelte:head><title>{tr('Ads')}</title></svelte:head>

<div class="flex flex-1 flex-col gap-4">
  <PageHeader title={tr('Ads')} description={tr('Banners and ad-network code shown on the public site.')}>
    {#snippet actions()}
      <PrimaryButton label={tr('Add Ad')} icon={MegaphoneIcon} onclick={openCreate} />
    {/snippet}
  </PageHeader>

  <DataTableToolbar {table} searchPlaceholder={tr('Filter ads...')} {columns}>
    {#snippet filters()}
      <DataTableFacetedFilter title={tr('Status')} options={statusOptions} selected={table.filters.state ?? []} counts={table.counts('state')} onChange={(v) => table.setFilter('state', v)} />
      <DataTableFacetedFilter title={tr('Type')} options={typeOptions} selected={table.filters.type ?? []} counts={table.counts('type')} onChange={(v) => table.setFilter('type', v)} />
    {/snippet}
  </DataTableToolbar>

  {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}

  <div class="overflow-hidden rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-10"><Checkbox checked={table.allOnPageSelected} indeterminate={table.someOnPageSelected} onCheckedChange={() => table.toggleAllOnPage()} aria-label={tr('Select all')} class="translate-y-0.5" /></TableHead>
          {#each visibleColumns as c (c.id)}
            <TableHead class={c.secondary ? 'hidden sm:table-cell' : ''}><DataTableColumnHeader {table} column={c.id} title={c.title} /></TableHead>
          {/each}
          <TableHead class="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if loading}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center"><Loader2Icon class="mx-auto size-4 animate-spin text-muted-foreground" /></TableCell></TableRow>
        {:else if table.pageRows.length === 0}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center text-muted-foreground">{table.isFiltered ? tr('No ads match your filters.') : tr('No ads yet. Add your first one.')}</TableCell></TableRow>
        {:else}
          {#each table.pageRows as ad (ad.id)}
            <TableRow data-state={table.isSelected(ad) ? 'selected' : undefined}>
              <TableCell><Checkbox checked={table.isSelected(ad)} onCheckedChange={() => table.toggleRow(ad)} aria-label={tr('Select row')} class="translate-y-0.5" /></TableCell>
              {#each visibleColumns as c (c.id)}
                <TableCell class={[c.id === 'name' ? 'max-w-[15rem] font-medium sm:max-w-xs' : 'text-nowrap', c.secondary && 'hidden sm:table-cell']}>
                  {#if c.id === 'name'}
                    <button type="button" class="block max-w-full truncate text-start hover:underline" onclick={() => openEdit(ad.id)}>{ad.name}</button>
                    <div class="mt-0.5 truncate text-xs font-normal text-muted-foreground">{runWindow(ad)}</div>
                    <!-- phones: status and place sit under the name -->
                    <div class="mt-1 flex items-center gap-2 text-xs font-normal text-muted-foreground sm:hidden">
                      <Badge variant="outline" class={stateColors[stateOf(ad)]}>{stateLabel(ad)}</Badge>
                      <span class="truncate">{placementLabel(ad.placement)}</span>
                    </div>
                  {:else if c.id === 'placement'}
                    <span class="text-sm">{placementLabel(ad.placement)}</span>
                  {:else if c.id === 'type'}
                    <span class="text-sm text-muted-foreground">{ad.type === 'banner' ? tr('Banner') : tr('Ad code')}</span>
                  {:else if c.id === 'state'}
                    <Badge variant="outline" class={stateColors[stateOf(ad)]}>{stateLabel(ad)}</Badge>
                  {:else}
                    <span class="text-sm text-muted-foreground tabular-nums">{ad.type === 'banner' ? ad.clicks : '-'}</span>
                  {/if}
                </TableCell>
              {/each}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    {#snippet child({ props })}
                      <Button {...props} variant="ghost" class="flex size-8 p-0 data-[state=open]:bg-muted"><EllipsisIcon class="size-4" /><span class="sr-only">{tr('Open menu')}</span></Button>
                    {/snippet}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-44">
                    <DropdownMenuItem onclick={() => openEdit(ad.id)}><PencilIcon /> {tr('Edit')}</DropdownMenuItem>
                    {#if ad.status === 'active'}
                      <DropdownMenuItem onclick={() => setStatus([ad], 'paused')}><PauseIcon /> {tr('Disable')}</DropdownMenuItem>
                    {:else}
                      <DropdownMenuItem onclick={() => setStatus([ad], 'active')}><PlayIcon /> {tr('Enable')}</DropdownMenuItem>
                    {/if}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onclick={() => (deleting = [ad])}><Trash2Icon /> {tr('Delete')}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          {/each}
        {/if}
      </TableBody>
    </Table>
  </div>

  <DataTablePagination {table} class="mt-auto" />
</div>

<DataTableBulkActions {table} entityName={msg('ad')}>
  {#snippet actions()}
    <Button size="sm" variant="outline" disabled={busy} onclick={() => setStatus(table.selectedRows, 'active')}><PlayIcon class="size-4" /> {tr('Enable')}</Button>
    <Button size="sm" variant="outline" disabled={busy} onclick={() => setStatus(table.selectedRows, 'paused')}><PauseIcon class="size-4" /> {tr('Disable')}</Button>
    <Button size="sm" variant="destructive" disabled={busy} onclick={() => (deleting = table.selectedRows)}><Trash2Icon class="size-4" /> {tr('Delete')}</Button>
  {/snippet}
</DataTableBulkActions>

<AdDialog bind:open={dialogOpen} adId={editingId} onsaved={load} />

<AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) deleting = null }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{deleting?.length === 1 ? tr('Delete this ad?') : tr('Delete {n} ads?', { n: deleting?.length ?? 0 })}</AlertDialogTitle>
      <AlertDialogDescription>{tr('It disappears from the site right away and its click count is lost. To hide it for a while, disable it instead.')}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{tr('Cancel')}</AlertDialogCancel>
      <AlertDialogAction onclick={confirmDelete}>{tr('Delete')}</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
