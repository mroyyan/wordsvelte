<script lang="ts">
  let { title, tags, limit = 20, context = 'sidebar' }: { title?: string, tags: any[], limit?: number, context?: string } = $props()
  let isFooter = $derived(context === 'footer')

  let sorted = $derived(tags.slice(0, limit))
</script>

{#if title}
  <div class="flex items-center gap-2 mb-3">
    <div class="h-4 w-1 {isFooter ? 'bg-red-500' : 'bg-red-600'} rounded-full"></div>
    <h3 class="font-bold uppercase text-sm tracking-wider {isFooter ? 'text-white' : 'text-gray-900'}">{title}</h3>
  </div>
{/if}
{#if sorted.length > 0}
  <div class="flex flex-wrap gap-2">
    {#each sorted as tag}
      <a
        href="/tag/{tag.slug}"
        class="inline-block px-3 py-1.5 text-xs font-medium rounded-full transition-colors {isFooter ? 'bg-white/10 text-gray-300 hover:bg-red-600 hover:text-white' : 'bg-gray-100 text-gray-700 hover:bg-red-600 hover:text-white'}"
      >
        {tag.name}
      </a>
    {/each}
  </div>
{/if}
