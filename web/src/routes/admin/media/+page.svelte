<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import UploadIcon from '@lucide/svelte/icons/upload'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import XIcon from '@lucide/svelte/icons/x'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog'
  import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  } from '$lib/components/ui/alert-dialog'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import PrimaryButton from '$lib/components/layout/primary-button.svelte'
  import { DataTableState, DataTableToolbar, DataTableFacetedFilter, DataTableBulkActions, DataTablePagination } from '$lib/components/data-table'
  import { api, errorMessage, fetchAll, runBulk } from '$lib/client/admin-api'

  interface MediaRow { id: number; r2Key: string; originalName: string; mimeType: string; size: number; width: number | null; height: number | null; createdAt: string }

  const typeOptions = [
    { label: 'JPEG', value: 'image/jpeg' },
    { label: 'PNG', value: 'image/png' },
    { label: 'GIF', value: 'image/gif' },
    { label: 'WebP', value: 'image/webp' },
    { label: 'AVIF', value: 'image/avif' },
  ]

  const table = new DataTableState<MediaRow>({
    getId: m => m.id,
    searchFields: [m => m.originalName],
    filterAccessors: { type: m => m.mimeType },
    sortAccessors: { name: m => m.originalName, size: m => m.size, date: m => Date.parse(m.createdAt) || 0 },
    pageSize: 24, // three rows of the widest grid
  })
  table.sort = { id: 'date', desc: true }

  let loading = $state(true)
  let error = $state('')
  let uploading = $state(false)
  let busy = $state(false)
  let previewItem = $state<MediaRow | null>(null)
  let deleting = $state<MediaRow[] | null>(null)
  let fileInput: HTMLInputElement | undefined = $state()

  const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`
  const formatDate = (s: string) => (!s || s.includes('datetime') ? '' : new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }))

  // only offer types that actually exist in the library
  const presentTypes = $derived(typeOptions.filter(o => table.rows.some(r => r.mimeType === o.value)))
  // the files on this page (search, filters and sort apply to every file; the pager then cuts the result)
  const visible = $derived(table.pageRows)
  const allSelected = $derived(visible.length > 0 && visible.every(m => table.selected.has(m.id)))
  const someSelected = $derived(!allSelected && visible.some(m => table.selected.has(m.id)))

  function toggleAllVisible() {
    const next = new Set(table.selected)
    if (allSelected) visible.forEach(m => next.delete(m.id))
    else visible.forEach(m => next.add(m.id))
    table.selected = next
  }

  async function load() {
    loading = true; error = ''
    try { table.setRows(await fetchAll<MediaRow>('/api/media')) }
    catch (e) { error = errorMessage(e) } finally { loading = false }
  }
  onMount(load)

  async function handleUpload(e: Event) {
    const input = e.target as HTMLInputElement
    const files = [...(input.files ?? [])]
    if (!files.length) return
    uploading = true
    const { ok, failed, firstError } = await runBulk(files, async file => {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/media', { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('wordsvelte_token') ?? ''}` }, body: fd })
      const json = await res.json().catch(() => null)
      if (!json?.success) throw new Error(`${file.name}: ${json?.error || `upload failed (${res.status})`}`)
    })
    input.value = ''
    await load(); uploading = false
    if (failed) toast.error(`${ok} uploaded, ${failed} failed. ${firstError}`)
    else toast.success(`${ok} file${ok === 1 ? '' : 's'} uploaded`)
  }

  async function confirmDelete() {
    const targets = deleting
    if (!targets) return
    deleting = null; busy = true
    const { ok, failed, firstError } = await runBulk(targets, m => api(`/api/media/${m.id}`, { method: 'DELETE' }))
    await load(); table.clearSelection(); busy = false
    if (failed) toast.error(`${ok} deleted, ${failed} failed: ${firstError}`)
    else toast.success(`${ok} file${ok === 1 ? '' : 's'} deleted`)
  }
</script>

<svelte:head><title>Media</title></svelte:head>

<div class="flex flex-1 flex-col gap-4">
  <PageHeader title="Media" description="Upload & manage images">
    {#snippet actions()}
      <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" multiple class="hidden" onchange={handleUpload} disabled={uploading} bind:this={fileInput} />
      <PrimaryButton label={uploading ? 'Uploading...' : 'Upload'} icon={uploading ? Loader2Icon : UploadIcon} disabled={uploading} onclick={() => fileInput?.click()} />
    {/snippet}
  </PageHeader>

  <DataTableToolbar {table} searchPlaceholder="Filter files...">
    {#snippet filters()}
      {#if presentTypes.length > 1}
        <DataTableFacetedFilter title="Type" options={presentTypes} selected={table.filters.type ?? []} counts={table.counts('type')} onChange={(v) => table.setFilter('type', v)} />
      {/if}
    {/snippet}
  </DataTableToolbar>

  {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}

  {#if loading}
    <div class="flex h-64 items-center justify-center text-muted-foreground"><Loader2Icon class="size-8 animate-spin" /></div>
  {:else if visible.length === 0}
    <div class="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
      <UploadIcon class="size-12 opacity-20" />
      <p>{table.rows.length === 0 ? 'No media yet. Upload your first image.' : 'No files match your filters.'}</p>
    </div>
  {:else}
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <Checkbox checked={allSelected} indeterminate={someSelected} onCheckedChange={toggleAllVisible} aria-label="Select all files" />
      <span>{allSelected ? 'Deselect all' : 'Select all'} on this page ({visible.length})</span>
    </div>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {#each visible as item (item.id)}
        {@const selected = table.selected.has(item.id)}
        <div class="group relative aspect-square overflow-hidden rounded-lg border bg-background transition-all hover:border-primary hover:ring-2 hover:ring-primary {selected ? 'border-primary ring-2 ring-primary' : ''}">
          <button type="button" class="size-full" onclick={() => (previewItem = item)} aria-label={`Preview ${item.originalName}`}>
            <img src="/api/media/{item.r2Key}" alt={item.originalName} class="size-full object-cover" loading="lazy" />
            <div class="absolute inset-0 flex flex-col items-center justify-end bg-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <span class="mb-0.5 w-full truncate text-[10px] font-medium text-white">{item.originalName}</span>
              <span class="text-[9px] text-white/70">{formatSize(item.size)}</span>
            </div>
          </button>
          <div class="absolute start-2 top-2 rounded bg-background/90 p-1 shadow-sm {selected ? '' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}">
            <Checkbox checked={selected} onCheckedChange={() => table.toggleRow(item)} aria-label={`Select ${item.originalName}`} />
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <DataTablePagination {table} pageSizes={[24, 48, 96]} class="mt-auto" />
</div>

<DataTableBulkActions {table} entityName="file">
  {#snippet actions()}
    <Button size="sm" variant="destructive" disabled={busy} onclick={() => (deleting = table.selectedRows)}><Trash2Icon class="size-4" /> Delete</Button>
  {/snippet}
</DataTableBulkActions>

<Dialog open={previewItem !== null} onOpenChange={(o) => { if (!o) previewItem = null }}>
  <DialogContent class="max-w-3xl" showCloseButton={false}>
    <DialogHeader>
      <div class="flex items-center justify-between">
        <DialogTitle>{previewItem?.originalName}</DialogTitle>
        <div class="flex items-center gap-1">
          <a href="/api/media/{previewItem?.r2Key}" download target="_blank" rel="noopener" aria-label="Download">
            <Button variant="ghost" size="icon" class="size-8"><DownloadIcon class="size-4" /></Button>
          </a>
          <Button variant="ghost" size="icon" class="size-8" onclick={() => (previewItem = null)} aria-label="Close"><XIcon class="size-4" /></Button>
        </div>
      </div>
    </DialogHeader>
    {#if previewItem}
      <div class="flex flex-col gap-4">
        <div class="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-lg bg-muted">
          <img src="/api/media/{previewItem.r2Key}" alt={previewItem.originalName} class="max-h-[60vh] max-w-full object-contain" />
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><span class="text-muted-foreground">File name</span><p class="truncate font-medium">{previewItem.originalName}</p></div>
          <div><span class="text-muted-foreground">Size</span><p class="font-medium">{formatSize(previewItem.size)}</p></div>
          <div><span class="text-muted-foreground">Type</span><p class="font-medium">{previewItem.mimeType}</p></div>
          <div><span class="text-muted-foreground">Uploaded</span><p class="font-medium">{formatDate(previewItem.createdAt) || 'Recently'}</p></div>
          {#if previewItem.width}
            <div><span class="text-muted-foreground">Dimensions</span><p class="font-medium">{previewItem.width} x {previewItem.height}</p></div>
          {/if}
        </div>
        <Button variant="destructive" class="h-10 w-full gap-2" onclick={() => { if (previewItem) deleting = [previewItem]; previewItem = null }}>
          <Trash2Icon class="size-4" /> Delete this file
        </Button>
      </div>
    {/if}
  </DialogContent>
</Dialog>

<AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) deleting = null }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete {deleting?.length === 1 ? 'this file' : `${deleting?.length} files`}?</AlertDialogTitle>
      <AlertDialogDescription>Posts that use {deleting?.length === 1 ? 'it' : 'them'} will show a broken image. This cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onclick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
