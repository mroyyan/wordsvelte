<script lang="ts">
  import { goto } from '$app/navigation'
  import { Search, X, Loader2 } from '@lucide/svelte'
  import { Dialog, DialogContent, DialogTitle } from '$lib/components/ui/dialog'
  import { formatDate } from '$lib/shared/format'

  interface Hit { id: number; slug: string; title: string; featuredImageUrl: string | null; publishedAt: string | null; createdAt: string }

  let { open = $bindable(false) }: { open?: boolean } = $props()

  const MIN_CHARS = 2
  const LIMIT = 6

  let query = $state('')
  let hits = $state<Hit[]>([])
  let total = $state(0)
  let loading = $state(false)
  let failed = $state(false)
  let active = $state(-1)
  let input = $state<HTMLInputElement>()

  const term = $derived(query.trim())
  const ready = $derived(term.length >= MIN_CHARS)

  // Live results: wait for a pause in typing, and drop answers that arrive for an older query.
  $effect(() => {
    const q = term
    if (q.length < MIN_CHARS) { hits = []; total = 0; loading = false; failed = false; active = -1; return }
    loading = true
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/posts?q=${encodeURIComponent(q)}&limit=${LIMIT}`, { signal: controller.signal })
        const json = await res.json()
        if (!json.success) throw new Error(json.error)
        hits = json.data
        total = json.total
        failed = false
        active = -1
        loading = false
      } catch (e: any) {
        if (e?.name === 'AbortError') return
        failed = true
        loading = false
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  })

  // Focus the field whenever the dialog opens; start fresh next time.
  $effect(() => {
    if (open) queueMicrotask(() => input?.focus())
    else query = ''
  })

  // "/" opens the search from anywhere outside a text field.
  function onWindowKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    if (e.key === '/' && !open && !/^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName ?? '') && !t?.isContentEditable) {
      e.preventDefault()
      open = true
    }
  }

  function go(href: string) {
    open = false
    goto(href)
  }

  const allResultsHref = $derived(`/search?q=${encodeURIComponent(term)}`)

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' && hits.length) { e.preventDefault(); active = (active + 1) % hits.length }
    else if (e.key === 'ArrowUp' && hits.length) { e.preventDefault(); active = active <= 0 ? hits.length - 1 : active - 1 }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && hits[active]) go(`/${hits[active].slug}`)
      else if (ready) go(allResultsHref)
    }
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<Dialog bind:open>
  <DialogContent showCloseButton={false} class="top-[8%] -translate-y-0 gap-0 overflow-hidden p-0 sm:top-[14%] sm:max-w-xl">
    <DialogTitle class="sr-only">Cari artikel</DialogTitle>

    <div class="flex items-center gap-3 border-b px-4">
      <Search class="h-4 w-4 shrink-0 text-gray-400" />
      <input
        bind:this={input}
        bind:value={query}
        onkeydown={onKeydown}
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        placeholder="Cari artikel..."
        aria-label="Cari artikel"
        class="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-gray-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {#if loading}
        <Loader2 class="h-4 w-4 shrink-0 animate-spin text-gray-400" />
      {:else if query}
        <button type="button" class="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700" aria-label="Hapus" onclick={() => { query = ''; input?.focus() }}><X class="h-4 w-4" /></button>
      {/if}
      <button type="button" class="shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium text-gray-500 hover:bg-gray-50" onclick={() => (open = false)}>Esc</button>
    </div>

    <div class="max-h-[60vh] overflow-y-auto">
      {#if !ready}
        <p class="px-4 py-8 text-center text-sm text-gray-500">Ketik minimal {MIN_CHARS} huruf untuk mencari berita.</p>
      {:else if failed}
        <p class="px-4 py-8 text-center text-sm text-red-600">Pencarian gagal. Coba lagi sebentar.</p>
      {:else if !loading && hits.length === 0}
        <p class="px-4 py-8 text-center text-sm text-gray-500">Tidak ada hasil untuk “{term}”.</p>
      {:else}
        <ul role="listbox" aria-label="Hasil pencarian" class="divide-y">
          {#each hits as hit, i (hit.id)}
            <li role="option" aria-selected={i === active}>
              <a
                href="/{hit.slug}"
                onclick={(e) => { e.preventDefault(); go(`/${hit.slug}`) }}
                onmousemove={() => (active = i)}
                class="flex gap-3 px-4 py-3 transition-colors {i === active ? 'bg-gray-50' : ''}"
              >
                <div class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 text-gray-400">
                  {#if hit.featuredImageUrl}
                    <img src={hit.featuredImageUrl} alt="" class="size-full object-cover" />
                  {:else}
                    <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
                  {/if}
                </div>
                <div class="min-w-0">
                  <div class="line-clamp-2 text-sm font-medium leading-snug text-gray-900 {i === active ? 'text-red-600' : ''}">{hit.title}</div>
                  <div class="mt-1 text-xs text-gray-500">{formatDate(hit.publishedAt || hit.createdAt)}</div>
                </div>
              </a>
            </li>
          {/each}
        </ul>
        {#if total > 0}
          <a href={allResultsHref} onclick={(e) => { e.preventDefault(); go(allResultsHref) }} class="block border-t bg-gray-50 px-4 py-3 text-center text-sm font-medium text-red-600 hover:bg-gray-100">
            Lihat semua {total} hasil untuk “{term}”
          </a>
        {/if}
      {/if}
    </div>
  </DialogContent>
</Dialog>
