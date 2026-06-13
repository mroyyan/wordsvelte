<script lang="ts">
  import { formatDate } from '$lib/utils'

  let { title, posts, limit = 5, context = 'sidebar' }: { title?: string, posts: any[], limit?: number, context?: string } = $props()
  let isFooter = $derived(context === 'footer')

  let sorted = $derived(
    [...posts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0)).slice(0, limit)
  )
</script>

{#if title}
  <div class="flex items-center gap-2 mb-3">
    <div class="h-4 w-1 {isFooter ? 'bg-red-500' : 'bg-red-600'} rounded-full"></div>
    <h3 class="font-bold uppercase text-sm tracking-wider {isFooter ? 'text-white' : 'text-gray-900'}">{title}</h3>
  </div>
{/if}
{#if sorted.length > 0}
  <div class="divide-y {isFooter ? 'divide-gray-700' : ''}">
    {#each sorted as post, i}
      <a href="/{post.slug}" class="flex gap-3 {isFooter ? 'px-4 py-3 hover:bg-white/5' : 'px-4 py-3 hover:bg-gray-50'} transition-colors">
        <span class="text-2xl font-bold {isFooter ? 'text-gray-600' : 'text-gray-200'} shrink-0 w-8">{i + 1}</span>
        <div class="min-w-0">
          <h4 class="text-sm font-medium leading-snug line-clamp-2 {isFooter ? 'text-gray-200 hover:text-white' : 'text-gray-900 hover:text-red-600'} transition-colors">{post.title}</h4>
          <span class="text-xs {isFooter ? 'text-gray-500' : 'text-gray-500'} mt-1 block">{formatDate(post.publishedAt || post.createdAt)}</span>
        </div>
      </a>
    {/each}
  </div>
{/if}
