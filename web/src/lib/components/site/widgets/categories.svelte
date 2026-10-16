<script lang="ts">
  let { title, categories, limit = 10, context = 'sidebar' }: { title?: string, categories: any[], limit?: number, context?: string } = $props()
  let isFooter = $derived(context === 'footer')

  let sorted = $derived(categories.slice(0, limit))
</script>

{#if title}
  <div class="flex items-center gap-2 mb-3">
    <div class="h-4 w-1 {isFooter ? 'bg-red-500' : 'bg-red-600'} rounded-full"></div>
    <h3 class="font-bold uppercase text-sm tracking-wider {isFooter ? 'text-white' : 'text-gray-900'}">{title}</h3>
  </div>
{/if}
{#if sorted.length > 0}
  <div class="space-y-2 text-sm">
    {#each sorted as cat}
      <a href="/kategori/{cat.slug}" class="flex justify-between items-center py-1 transition-colors {isFooter ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-red-600'}">
        <span>{cat.name}</span>
      </a>
    {/each}
  </div>
{/if}
