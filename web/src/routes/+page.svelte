<script lang="ts">
  import { formatDate, formatExcerpt } from '$lib/utils'
  import { page } from '$app/stores'
  import { Clock, Eye, ChevronRight, ChevronLeft, Megaphone } from '@lucide/svelte'
  import WidgetRenderer from '$lib/components/widgets/widget-renderer.svelte'

  let { data } = $props()
  let posts = $derived(data.posts)
  let pagination = $derived(data.pagination)
  let featuredPosts = $derived(data.featuredPosts || [])
  let featured = $derived(featuredPosts.length > 0 ? featuredPosts[0] : posts[0])
  let subFeatured = $derived(featuredPosts.length > 0 ? featuredPosts.slice(1, 5) : [])
  let rest = $derived(posts)

  let sidebarWidgets = $derived($page.data.widgets?.filter((w: any) => w.sidebarArea === 'sidebar-1') || [])
  let stickySidebar = $derived($page.data.settings?.sticky_sidebar === 'true')
  let categories = $derived(data.categories || [])
  let tags = $derived(data.tags || [])

  function getPageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
    return [1, '...', current - 1, current, current + 1, '...', total]
  }
</script>

<!-- News Ticker -->
{#if posts.length > 0}
  <div class="flex items-center gap-3 mb-6 bg-gray-50 border rounded-lg px-4 py-2.5">
    <span class="text-xs font-bold uppercase text-red-600 shrink-0 tracking-wider flex items-center gap-1.5">
      <Megaphone class="h-3.5 w-3.5" />
      Terkini
    </span>
    <div class="h-4 w-px bg-gray-300 shrink-0"></div>
    <div class="flex-1 overflow-hidden relative h-5">
      <div class="absolute inset-0 flex items-center overflow-hidden">
        <div class="whitespace-nowrap animate-scroll inline-flex gap-8 text-sm text-gray-600">
          {#each [...posts, ...posts] as post, i}
            <a href="/{post.slug}" class="hover:text-red-600 transition-colors">{post.title}</a>
            <span class="text-gray-300">•</span>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Featured Grid -->
{#if featured}
  <section class="mb-10">
    <div class="grid lg:grid-cols-5 gap-3">
      <a href="/{featured.slug}" class="lg:col-span-3 group relative overflow-hidden rounded-xl aspect-video lg:aspect-auto lg:min-h-[420px] shadow-md">
        {#if featured.featuredImageUrl}
          <img src={featured.featuredImageUrl} alt={featured.title} class="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-700" />
        {:else}
          <div class="w-full h-full absolute inset-0 bg-gray-800"></div>
        {/if}
        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent"></div>
        <div class="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <span class="inline-block bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 mb-3 uppercase tracking-wider rounded-sm">Breaking News</span>
          <h2 class="text-white text-2xl md:text-3xl font-bold leading-tight mb-3 group-hover:text-red-400 transition-colors line-clamp-2">{featured.title}</h2>
          <p class="text-gray-300 text-sm line-clamp-2 mb-3 hidden md:block">{formatExcerpt(featured.excerpt || featured.content, 150)}</p>
          <div class="flex items-center gap-4 text-xs text-gray-400">
            <span class="flex items-center gap-1.5"><Clock class="h-3.5 w-3.5" /> {formatDate(featured.publishedAt || featured.createdAt)}</span>
            <span class="flex items-center gap-1.5"><Eye class="h-3.5 w-3.5" /> {featured.viewCount || 0} dilihat</span>
          </div>
        </div>
      </a>
      {#if subFeatured.length > 0}
        <div class="lg:col-span-2 grid grid-cols-2 gap-3 min-h-[420px]">
          {#each subFeatured as post}
            <a href="/{post.slug}" class="group relative overflow-hidden rounded-xl shadow-sm h-full">
              <div class="absolute inset-0">
                {#if post.featuredImageUrl}
                  <img src={post.featuredImageUrl} alt={post.title} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                {:else}
                  <div class="w-full h-full bg-gray-300"></div>
                {/if}
              </div>
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <div class="absolute bottom-0 left-0 right-0 p-3">
                <h3 class="text-white text-sm font-bold leading-snug line-clamp-2 group-hover:text-red-400 transition-colors">{post.title}</h3>
                <span class="text-gray-300 text-[10px] mt-1 block">{formatDate(post.publishedAt || post.createdAt)}</span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </section>
{/if}

<!-- Main Content + Sidebar -->
<div class="grid lg:grid-cols-3 gap-8">
  <!-- Main Content -->
  <div class="lg:col-span-2">
    <!-- Berita Terbaru Section -->
    {#if rest.length > 0}
    <section class="bg-white rounded-lg border overflow-hidden">
      <div class="px-5 pt-5 pb-3">
        <div class="flex items-center gap-2">
          <div class="h-4 w-1 bg-red-600 rounded-full"></div>
          <h2 class="font-bold uppercase text-sm tracking-wider text-gray-900">Berita Terbaru</h2>
        </div>
      </div>

      <div class="divide-y px-5">
        {#each rest as post}
            <article class="flex gap-5 py-5">
              <a href="/{post.slug}" class="shrink-0 w-28 md:w-44 self-start aspect-[3/2] overflow-hidden rounded-md bg-gray-100 flex items-center justify-center text-gray-400">
                {#if post.featuredImageUrl}
                  <img src={post.featuredImageUrl} alt={post.title} class="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                {:else}
                  <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
                {/if}
              </a>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-base leading-snug mb-1.5">
                  <a href="/{post.slug}" class="hover:text-red-600 transition-colors line-clamp-2">{post.title}</a>
                </h3>
                <div class="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <span>{formatDate(post.publishedAt || post.createdAt)}</span>
                </div>
                <p class="text-sm text-gray-600 leading-relaxed line-clamp-2">{formatExcerpt(post.excerpt || post.content, 150)}</p>
              </div>
          </article>
        {/each}
      </div>

      {#if pagination && pagination.totalPages > 1}
        <div class="flex items-center justify-center gap-2 py-6 border-t">
          {#if pagination.page > 1}
            <a href="/?page={pagination.page - 1}" class="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition-colors">
              <ChevronLeft class="h-4 w-4" /> Prev
            </a>
          {/if}
          {#each getPageNumbers(pagination.page, pagination.totalPages) as pn}
            {#if pn === '...'}
              <span class="px-2 text-sm text-gray-400">…</span>
            {:else}
              <a href="/?page={pn}" class="inline-flex items-center justify-center w-9 h-9 text-sm font-medium rounded-lg transition-colors {pn === pagination.page ? 'bg-red-600 text-white' : 'text-gray-600 bg-white border hover:bg-gray-50'}">
                {pn}
              </a>
            {/if}
          {/each}
          {#if pagination.page < pagination.totalPages}
            <a href="/?page={pagination.page + 1}" class="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition-colors">
              Next <ChevronRight class="h-4 w-4" />
            </a>
          {/if}
        </div>
      {/if}
    </section>
    {/if}
  </div>

  <!-- Sidebar -->
  <aside class="space-y-6 {stickySidebar ? 'lg:sticky lg:top-20 lg:self-start' : ''}">
    {#each sidebarWidgets as widget (widget.id)}
      <div class="bg-white rounded-lg border p-4">
        <WidgetRenderer {widget} {posts} {categories} {tags} />
      </div>
    {/each}
    {#if sidebarWidgets.length === 0}
      <div class="bg-white rounded-lg border p-4 text-center text-sm text-muted-foreground">
        No widgets configured. Add widgets in admin Appearance &rarr; Widgets.
      </div>
    {/if}
  </aside>
</div>

<style>
  @keyframes scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  :global(.animate-scroll) {
    animation: scroll 30s linear infinite;
  }
  :global(.animate-scroll:hover) {
    animation-play-state: paused;
  }
</style>
