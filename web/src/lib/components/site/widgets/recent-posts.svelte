<script lang="ts">
  import { formatDate } from '$lib/shared/format'

  let { title, posts, limit = 5, context = 'sidebar' }: { title?: string, posts: any[], limit?: number, context?: string } = $props()
  let isFooter = $derived(context === 'footer')

  let sorted = $derived(
    [...posts]
      .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())
      .slice(0, limit)
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
    {#each sorted as post}
      <a href="/{post.slug}" class="flex gap-3 {isFooter ? 'py-3 hover:bg-white/5' : 'py-3 hover:bg-gray-50'} transition-colors">
        {#if post.featuredImageUrl}
          <img src={post.featuredImageUrl} alt="" class="w-14 h-14 object-cover rounded shrink-0" />
        {:else}
          <div class="flex w-14 h-14 shrink-0 items-center justify-center rounded {isFooter ? 'bg-white/10 text-gray-500' : 'bg-gray-100 text-gray-400'}" aria-hidden="true">
            <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
          </div>
        {/if}
        <div class="min-w-0 flex-1">
          <h4 class="text-sm font-medium leading-snug line-clamp-2 {isFooter ? 'text-gray-200 hover:text-white' : 'text-gray-900 hover:text-red-600'} transition-colors">{post.title}</h4>
          <span class="text-xs {isFooter ? 'text-gray-500' : 'text-gray-500'} mt-1 block">{formatDate(post.publishedAt || post.createdAt)}</span>
        </div>
      </a>
    {/each}
  </div>
{/if}
