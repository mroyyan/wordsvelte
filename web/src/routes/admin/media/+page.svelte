<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '$lib/components/ui/alert-dialog'
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog'
  import { Upload, Trash2, Search, X, Loader2, Download, Clock } from '@lucide/svelte'
  import MediaLibrary from '$lib/components/admin/media/MediaLibrary.svelte'

  let items = $state<any[]>([])
  let loading = $state(true)
  let uploading = $state(false)
  let search = $state('')
  let deleteId = $state<number | null>(null)
  let previewItem = $state<any | null>(null)
  let showMediaLibrary = $state(false)

  function t() { return localStorage.getItem('kubus_token') }

  async function fetchMedia() {
    const tok = t(); if (!tok) return
    try {
      const r = await fetch('/api/media', { headers: { Authorization: `Bearer ${tok}` } })
      const j = await r.json(); items = j.data ?? []
    } catch {} finally { loading = false }
  }

  onMount(fetchMedia)

  async function handleUpload(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
    const tok = t(); if (!tok) return; uploading = true
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch('/api/media', { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd })
      const j = await r.json(); if (j.data) items = [j.data, ...items]
    } catch (e: any) { alert(e.message) } finally { uploading = false }
  }

  async function handleDelete() {
    if (!deleteId) return; const tok = t(); if (!tok) return
    try {
      await fetch(`/api/media/${deleteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } })
      items = items.filter(m => m.id !== deleteId)
    } catch (e: any) { alert(e.message) } finally { deleteId = null }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  function formatDate(dateStr: string) {
    if (!dateStr || dateStr.includes('datetime')) return ''
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const filtered = $derived(search ? items.filter(i => i.originalName.toLowerCase().includes(search.toLowerCase())) : items)
  let fileInput: HTMLInputElement | undefined = $state()
</script>

<div class="flex flex-1 flex-col gap-6">
  <div class="flex flex-wrap items-end justify-between gap-2">
    <div><h2 class="text-2xl font-bold tracking-tight">Media</h2><p class="text-muted-foreground">Upload & manage images</p></div>
    <div class="flex items-center gap-2">
      <input type="file" accept="image/*" class="hidden" onchange={handleUpload} disabled={uploading} bind:this={fileInput} />
      <Button size="sm" class="h-9 gap-2" disabled={uploading} onclick={() => fileInput?.click()}>
        {#if uploading}<Loader2 class="h-4 w-4 animate-spin" />{:else}<Upload class="h-4 w-4" />{/if}
        Upload
      </Button>
    </div>
  </div>

  {#if items.length > 0}
    <div class="relative max-w-sm">
      <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input placeholder="Search media..." class="pl-9 h-9" bind:value={search} />
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center h-64 text-muted-foreground"><Loader2 class="h-8 w-8 animate-spin" /></div>
  {:else if filtered.length === 0}
    <div class="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
      <Upload class="h-12 w-12 opacity-20" />
      <p>{items.length === 0 ? 'No media yet. Upload your first image.' : 'No results found.'}</p>
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
      {#each filtered as item (item.id)}
        <button
          type="button"
          class="group relative aspect-square rounded-lg overflow-hidden border bg-background hover:ring-2 hover:ring-primary hover:border-primary transition-all"
          onclick={() => previewItem = item}
        >
          <img src="/api/media/{item.r2Key}" alt={item.originalName} class="w-full h-full object-cover" loading="lazy" />
          <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-end p-2 transition-opacity">
            <span class="text-[10px] text-white font-medium truncate w-full mb-0.5">{item.originalName}</span>
            <span class="text-[9px] text-white/70">{formatSize(item.size)}</span>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<MediaLibrary
  bind:open={showMediaLibrary}
  onSelect={(url: string) => {
    window.open(url, '_blank')
  }}
/>

<Dialog open={previewItem !== null} onOpenChange={(o) => { if (!o) previewItem = null }}>
  <DialogContent class="max-w-3xl" showCloseButton={false}>
    <DialogHeader>
      <div class="flex items-center justify-between">
        <DialogTitle>{previewItem?.originalName}</DialogTitle>
        <div class="flex items-center gap-1">
          <a href="/api/media/{previewItem?.r2Key}" download target="_blank">
            <Button variant="ghost" size="icon" class="h-8 w-8"><Download class="h-4 w-4" /></Button>
          </a>
          <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => previewItem = null}><X class="h-4 w-4" /></Button>
        </div>
      </div>
    </DialogHeader>
    {#if previewItem}
      <div class="flex flex-col gap-4">
        <div class="bg-muted rounded-lg overflow-hidden flex items-center justify-center max-h-[60vh]">
          <img src="/api/media/{previewItem.r2Key}" alt={previewItem.originalName} class="max-w-full max-h-[60vh] object-contain" />
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><span class="text-muted-foreground">File name</span><p class="font-medium truncate">{previewItem.originalName}</p></div>
          <div><span class="text-muted-foreground">Size</span><p class="font-medium">{formatSize(previewItem.size)}</p></div>
          <div><span class="text-muted-foreground">Type</span><p class="font-medium">{previewItem.mimeType}</p></div>
          <div><span class="text-muted-foreground">Uploaded</span><p class="font-medium">{formatDate(previewItem.createdAt) || 'Recently'}</p></div>
          {#if previewItem.width}
            <div><span class="text-muted-foreground">Dimensions</span><p class="font-medium">{previewItem.width} x {previewItem.height}</p></div>
          {/if}
        </div>
        <Button variant="destructive" class="w-full gap-2 h-10" onclick={() => { deleteId = previewItem.id; previewItem = null }}>
          <Trash2 class="h-4 w-4" /> Delete this file
        </Button>
      </div>
    {/if}
  </DialogContent>
</Dialog>

<AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) deleteId = null }}>
  <AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>Delete media?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onclick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
