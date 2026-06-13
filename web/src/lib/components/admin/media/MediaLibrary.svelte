<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Loader2, Search, X, UploadCloud } from '@lucide/svelte'
  import { Input } from '$lib/components/ui/input'

  let { open = $bindable(false), onSelect } = $props()
  let items = $state<any[]>([])
  let loading = $state(true)
  let search = $state('')
  let uploading = $state(false)
  let fileInput: HTMLInputElement | undefined = $state()

  async function fetchMedia() {
    loading = true
    try {
      const res = await fetch('/api/media', {
        headers: { Authorization: `Bearer ${localStorage.getItem('kubus_token')}` }
      })
      const json = await res.json()
      items = json.data ?? []
    } finally { loading = false }
  }

  async function handleUpload(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    uploading = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('kubus_token')}` },
        body: formData
      })
      const json = await res.json()
      if (json.success) {
        await fetchMedia()
      }
    } finally {
      uploading = false
    }
  }

  onMount(() => { if (open) fetchMedia() })
  $effect(() => { if (open) fetchMedia() })

  const filtered = $derived(items.filter(i => i.originalName.toLowerCase().includes(search.toLowerCase())))

  function select(item: any) {
    onSelect(`/api/media/${item.r2Key}`)
    open = false
  }
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
            <Input placeholder="Search media..." class="pl-9 h-9" bind:value={search} />
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
      {#if loading}
        <div class="flex items-center justify-center h-full"><Loader2 class="animate-spin h-8 w-8 text-primary" /></div>
      {:else if filtered.length === 0}
        <div class="flex flex-col items-center justify-center h-full py-12 text-muted-foreground">
          <UploadCloud class="h-12 w-12 mb-4 opacity-20" />
          <p>No media found.</p>
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {#each filtered as item}
            <button
              type="button"
              class="group relative aspect-square rounded-lg overflow-hidden border bg-background hover:ring-2 hover:ring-primary hover:border-primary transition-all"
              onclick={() => select(item)}
            >
              <img src="/api/media/{item.r2Key}" alt={item.originalName} class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-end p-2 transition-opacity">
                <span class="text-[10px] text-white font-medium truncate w-full mb-1">{item.originalName}</span>
                <span class="text-[9px] text-white/70">{(item.size / 1024).toFixed(0)} KB</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
