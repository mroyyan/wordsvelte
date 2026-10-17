<script lang="ts">
  import { t } from '$lib/i18n'
  import { formatExcerpt } from '$lib/utils'
  import { formatDate } from '$lib/shared/format'
  import Seo from '$lib/components/site/seo.svelte'
  import { page } from '$app/stores'
  import { Clock, Eye, ChevronRight, ChevronLeft } from '@lucide/svelte'
  import AdSlot from '$lib/components/site/ad-slot.svelte'
  import WidgetRenderer from '$lib/components/site/widgets/widget-renderer.svelte'

  let { data } = $props()
  let rail = $state<HTMLElement>()
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

  /** A narrow window for phones: first, last and the pages right around the current one. */
  function compactPageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    const out: (number | '...')[] = [1]
    if (start > 2) out.push('...')
    for (let p = start; p <= end; p++) out.push(p)
    if (end < total - 1) out.push('...')
    out.push(total)
    return out
  }

  function getPageNumbers(current: number, total: number): (number | '...')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
    return [1, '...', current - 1, current, current + 1, '...', total]
  }

</script>

<Seo home pageNumber={pagination?.page} />

<!-- Featured: one large lead story, then up to four more stories as overlay cards in a slider (swipe on touch, arrows with a mouse). Square corners throughout. -->
{#snippet noImage()}
  <div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-700 via-neutral-800 to-neutral-950" aria-hidden="true">
    <svg class="h-10 w-10 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
  </div>
{/snippet}

<!-- Main Content + Sidebar -->
<div class="grid lg:grid-cols-3 gap-8">
  <!-- Main Content -->
  <div class="lg:col-span-2">
  {#if featured}
    <section class="mb-10 -mt-6 md:mt-0" aria-label={t('home.featuredAria')}>
      <!-- Lead story: edge to edge on phones -->
      <a
        href="/{featured.slug}"
        class="group relative isolate -mx-4 block aspect-[4/3] overflow-hidden bg-neutral-900 sm:mx-0 sm:rounded-xl sm:aspect-video lg:aspect-video"
      >
        {#if featured.featuredImageUrl}
          <img
            src={featured.featuredImageUrl}
            alt=""
            fetchpriority="high"
            class="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        {:else}
          {@render noImage()}
        {/if}
        <div class="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/30 to-transparent"></div>

        <div class="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
          {#if featured.categoryName}
            <span class="mb-3 inline-block rounded-sm bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">{featured.categoryName}</span>
          {/if}
          <h2 class="line-clamp-3 max-w-4xl text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-4xl lg:leading-[1.15]">
            <span class="bg-gradient-to-r from-red-500 to-red-500 bg-[length:0_2px] bg-bottom bg-no-repeat transition-[background-size] duration-500 group-hover:bg-[length:100%_2px]">{featured.title}</span>
          </h2>
          <div class="mt-3 flex items-center gap-4 text-xs text-gray-300">
            <span class="flex items-center gap-1.5"><Clock class="h-3.5 w-3.5" /> <time datetime={featured.publishedAt || featured.createdAt}>{formatDate(featured.publishedAt || featured.createdAt)}</time></span>
            <span class="flex items-center gap-1.5"><Eye class="h-3.5 w-3.5" /> {t('home.views', { n: featured.viewCount || 0 })}</span>
          </div>
        </div>
      </a>

      <!-- Edge-to-edge cards; below lg the next card peeks in to show the row scrolls -->
      {#if subFeatured.length > 0}
        <div class="group/rail relative mt-0.5">
<div bind:this={rail} class="-mx-4 flex snap-x snap-mandatory gap-0.5 overflow-x-auto scroll-smooth [scrollbar-width:none] sm:mx-0 [&::-webkit-scrollbar]:hidden">
          {#each subFeatured as post}
            <a href="/{post.slug}" class="group relative isolate block aspect-[16/10] w-[62%] shrink-0 snap-start overflow-hidden bg-neutral-900 sm:rounded-xl sm:w-[38%] lg:w-[44%]">
              {#if post.featuredImageUrl}
                <img src={post.featuredImageUrl} alt="" loading="lazy" class="absolute inset-0 -z-10 size-full object-cover transition-transform duration-700 group-hover:scale-105" />
              {:else}
                {@render noImage()}
              {/if}
              <div class="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>
              <div class="absolute inset-x-0 bottom-0 p-3">
                {#if post.categoryName}
                  <span class="mb-1.5 inline-block rounded-sm bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{post.categoryName}</span>
                {/if}
                <h3 class="line-clamp-3 text-[13px] font-bold leading-snug text-white">{post.title}</h3>
                <time class="mt-1.5 block text-[11px] text-gray-300" datetime={post.publishedAt || post.createdAt}>{formatDate(post.publishedAt || post.createdAt)}</time>
              </div>
            </a>
          {/each}
        </div>
        <!-- arrows for mouse users; touch screens just swipe -->
        <button type="button" class="absolute left-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md transition-opacity hover:bg-white lg:flex lg:opacity-0 lg:group-hover/rail:opacity-100" aria-label={t('pager.previous')} onclick={() => rail?.scrollBy({ left: -rail.clientWidth * 0.8, behavior: 'smooth' })}><ChevronLeft class="h-5 w-5" /></button>
        <button type="button" class="absolute right-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-md transition-opacity hover:bg-white lg:flex lg:opacity-0 lg:group-hover/rail:opacity-100" aria-label={t('pager.next')} onclick={() => rail?.scrollBy({ left: rail.clientWidth * 0.8, behavior: 'smooth' })}><ChevronRight class="h-5 w-5" /></button>
      </div>
      {/if}
    </section>
  {/if}

    <!-- Berita Terbaru Section -->
    {#if rest.length > 0}
    <section id="berita-terbaru" class="panel overflow-hidden scroll-mt-20">
      <div class="pb-3 md:px-5 md:pt-5">
        <div class="flex items-center gap-2">
          <div class="h-4 w-1 bg-red-600 rounded-full"></div>
          <h2 class="font-bold uppercase text-sm tracking-wider text-gray-900">{t('home.latest')}</h2>
        </div>
      </div>

      <div class="divide-y md:px-5">
        {#each rest as post, i}
            <article class="flex gap-5 py-5">
              <a href="/{post.slug}" class="shrink-0 w-28 sm:w-36 md:w-44 self-start aspect-square md:aspect-[4/3] overflow-hidden rounded-md bg-gray-100 flex items-center justify-center text-gray-400">
                {#if post.featuredImageUrl}
                  <img src={post.featuredImageUrl} alt={post.title} class="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                {:else}
                  <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"/></svg>
                {/if}
              </a>
              <div class="flex-1 min-w-0">
                <h3 class="font-bold text-base leading-snug mb-1 sm:text-lg md:text-xl md:mb-1.5">
                  <a href="/{post.slug}" class="hover:text-red-600 transition-colors line-clamp-2">{post.title}</a>
                </h3>
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400 mb-2">
                  {#if post.categoryName}
                    <span class="rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-600">{post.categoryName}</span>
                  {/if}
                  <span>{formatDate(post.publishedAt || post.createdAt)}</span>
                </div>
                <p class="text-[13px] text-gray-600 leading-relaxed line-clamp-2 md:text-sm">{formatExcerpt(post.excerpt || post.content, 150)}</p>
              </div>
          </article>
          <!-- an ad after every fifth story (not at the very end of the list) -->
          {#if (i + 1) % 5 === 0 && i < rest.length - 1}
            <div class="py-5"><AdSlot placement="between-posts" /></div>
          {/if}
        {/each}
      </div>

      {#if pagination && pagination.totalPages > 1}
        <div class="flex items-center justify-center gap-1 border-t py-6 sm:gap-2">
          {#if pagination.page > 1}
            <a href="/?page={pagination.page - 1}#berita-terbaru" aria-label={t('pager.previous')} class="inline-flex h-9 items-center gap-1 rounded-lg border bg-white px-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 sm:px-3">
              <ChevronLeft class="h-4 w-4" /> <span class="hidden sm:inline">{t('pager.previous')}</span>
            </a>
          {/if}
          {#snippet pageLinks(list: (number | '...')[])}
            {#each list as pn}
              {#if pn === '...'}
                <span class="px-1 text-sm text-gray-400 sm:px-2">…</span>
              {:else}
                <a href="/?page={pn}#berita-terbaru" aria-current={pn === pagination.page ? 'page' : undefined} class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors {pn === pagination.page ? 'bg-red-600 text-white' : 'border bg-white text-gray-600 hover:bg-gray-50'}">
                  {pn}
                </a>
              {/if}
            {/each}
          {/snippet}
          <div class="flex items-center gap-1 sm:hidden">{@render pageLinks(compactPageNumbers(pagination.page, pagination.totalPages))}</div>
          <div class="hidden items-center gap-2 sm:flex">{@render pageLinks(getPageNumbers(pagination.page, pagination.totalPages))}</div>
          {#if pagination.page < pagination.totalPages}
            <a href="/?page={pagination.page + 1}#berita-terbaru" aria-label={t('pager.next')} class="inline-flex h-9 items-center gap-1 rounded-lg border bg-white px-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 sm:px-3">
              <span class="hidden sm:inline">{t('pager.next')}</span> <ChevronRight class="h-4 w-4" />
            </a>
          {/if}
        </div>
      {/if}
    </section>
    {/if}
  </div>

  <!-- Sidebar -->
  <aside class="space-y-6 max-md:border-t max-md:pt-6 {stickySidebar ? 'lg:sticky lg:top-20 lg:self-start' : ''}">
    <AdSlot placement="sidebar-top" />
    {#each sidebarWidgets as widget (widget.id)}
      <div class="panel md:p-4">
        <WidgetRenderer {widget} {categories} {tags} />
      </div>
    {/each}
    <AdSlot placement="sidebar-bottom" />
    {#if sidebarWidgets.length === 0}
      <div class="panel text-center text-sm text-muted-foreground md:p-4">
        {t('home.noWidgets')}
      </div>
    {/if}
  </aside>
</div>
