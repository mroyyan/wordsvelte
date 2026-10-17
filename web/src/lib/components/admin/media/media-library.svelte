<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { ChevronLeft, ChevronRight, Loader2, Search, X, UploadCloud } from '@lucide/svelte'
  import { Input } from '$lib/components/ui/input'

  let { open = $bindable(false), onSelect } = $props()

  const PAGE_SIZE = 24

  let items = $state<any[]>([])
  let loading = $state(true)
  let failed = $state(false)
  let search = $state('')
  let page = $state(1)
  let total = $state(0)
  let totalPages = $state(1)
  let uploading = $state(false)
  let fileInput: HTMLInputElement | undefined = $state()

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('wordsvelte_token')}` })

  // The server does the paging and the searching, so a library with thousands of files stays quick.
  async function fetchMedia(signal?: AbortSignal) {
    loading = true
    failed = false
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (search.trim()) query.set('q', search.trim())
      const res = await fetch(`/api/media?${query}`, { headers: headers(), signal })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      items = json.data ?? []
      total = json.total ?? items.length
      totalPages = Math.max(1, json.totalPages ?? 1)
      // deleted files elsewhere can leave us past the last page
      if (page > totalPages) { page = totalPages; return fetchMedia(signal) }
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      failed = true
    } finally {
      loading = false
    }
  }

  async function handleUpload(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    uploading = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/media', { method: 'POST', headers: headers(), body: formData })
      const json = await res.json()
      if (json.success) {
        // newest first: show the page the new file is on
        search = ''
        page = 1
        await fetchMedia()
      }
    } finally {
      uploading = false
      target.value = ''
    }
  }

  // Reload whenever the dialog opens, the page changes or the search text changes (typing waits for a short pause).
  let lastSearch = ''
  $effect(() => {
    if (!open) return
    const q = search
    const p = page
    void p
    const controller = new AbortController()
    const delay = q !== lastSearch ? 300 : 0
    const timer = setTimeout(() => { lastSearch = q; fetchMedia(controller.signal) }, delay)
    return () => { clearTimeout(timer); controller.abort() }
  })

  function onSearchInput() {
    page = 1
  }

  function select(item: any) {
    onSelect(`/api/media/${item.r2Key}`)
    open = false
  }

  const from = $derived(total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1)
  const to = $derived(Math.min(total, page * PAGE_SIZE))
</script>

<Dialog.Root bind:open>
  <Dialog.Content showCloseButton={false} class="max-w-[95vw] w-[1200px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
    <Dialog.Header class="px-6 py-4 border-b">
      <div class="flex items-center justify-between gap-4">
        <div>
          <Dialog.Title>Media Library</Dialog.Title>
        </div>
        <div class="flex items-center gap-2 flex-1 max-w-md ml-auto">
          <div class="relative flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search media..." class="pl-9 h-9" bind:value={search} oninput={onSearchInput} />
          </div>
          <input type="file" accept="image/*" class="hidden" bind:this={fileInput} onchange={handleUpload} disabled={uploading} />
          <Button variant="default" size="sm" class="h-9 gap-2" disabled={uploading} onclick={() => fileInput?.click()}>
            {#if uploading}<Loader2 class="h-4 w-4 animate-spin" />{:else}<UploadCloud class="h-4 w-4" />{/if}
            Upload
          </Button>
          <Button type="button" variant="outline" size="icon" class="h-9 w-9 shrink-0" onclick={() => open = false}>
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Dialog.Header>

    <div class="flex-1 overflow-y-auto p-6 bg-muted/20">
      {#if loading && items.length === 0}
        <div class="flex items-center justify-center h-full"><Loader2 class="animate-spin h-8 w-8 text-primary" /></div>
      {:else if failed}
        <div class="flex flex-col items-center justify-center h-full py-12 text-destructive">
          <p>Could not load the media.</p>
          <Button variant="outline" size="sm" class="mt-3" onclick={() => fetchMedia()}>Try again</Button>
        </div>
      {:else if items.length === 0}
        <div class="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
          <UploadCloud class="h-12 w-12 mb-4 opacity-20" />
          <p>{search.trim() ? 'No files match your search.' : 'No media yet. Upload an image.'}</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 transition-opacity {loading ? 'opacity-50' : ''}">
          {#each items as item (item.id)}
            <button
              type="button"
              class="group relative aspect-square rounded-lg overflow-hidden border bg-background hover:ring-2 hover:ring-primary hover:border-primary transition-all"
              onclick={() => select(item)}
            >
              <img src="/api/media/{item.r2Key}" alt={item.originalName} loading="lazy" class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-end p-2 transition-opacity">
                <span class="text-[10px] text-white font-medium truncate w-full mb-1">{item.originalName}</span>
                <span class="text-[9px] text-white/70">{(item.size / 1024).toFixed(0)} KB</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    {#if total > 0}
      <div class="flex items-center justify-between gap-3 border-t px-6 py-3 text-sm">
        <span class="text-muted-foreground">{from}-{to} of {total}</span>
        <div class="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" class="size-8" aria-label="Previous page" disabled={page <= 1 || loading} onclick={() => (page -= 1)}><ChevronLeft class="size-4" /></Button>
          <span class="min-w-24 text-center font-medium">Page {page} of {totalPages}</span>
          <Button type="button" variant="outline" size="icon" class="size-8" aria-label="Next page" disabled={page >= totalPages || loading} onclick={() => (page += 1)}><ChevronRight class="size-4" /></Button>
        </div>
      </div>
    {/if}
  </Dialog.Content>
</Dialog.Root>
