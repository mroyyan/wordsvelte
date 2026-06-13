<script lang="ts">
  import { formatDate, formatExcerpt } from '$lib/utils'
  import { Search } from '@lucide/svelte'

  let { data } = $props()
  let { query, results } = $derived(data)

  let searchInput = $state(query)
</script>

<div class="max-w-3xl mx-auto">
  <h1 class="text-2xl font-bold mb-6">Pencarian</h1>

  <form method="GET" class="mb-8">
    <div class="flex gap-2">
      <input type="search" name="q" bind:value={searchInput} placeholder="Cari artikel..." class="flex-1 border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none" />
      <button type="submit" class="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2">
        <Search class="h-4 w-4" /> Cari
      </button>
    </div>
  </form>

  {#if query}
    <p class="text-gray-500 mb-4">Hasil untuk "{query}" ({results.length} ditemukan)</p>

    {#if results.length === 0}
      <p class="text-gray-500">Tidak ada hasil untuk pencarian ini.</p>
    {:else}
      <div class="space-y-4">
        {#each results as post}
          <article class="bg-white rounded-lg border p-4">
            <h2 class="font-bold text-base"><a href="/{post.slug}" class="hover:text-red-600">{post.title}</a></h2>
            <p class="text-xs text-gray-500 mt-1">{formatDate(post.publishedAt || post.createdAt)}</p>
            <p class="text-sm text-gray-600 mt-2">{formatExcerpt(post.excerpt || post.content, 200)}</p>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</div>
