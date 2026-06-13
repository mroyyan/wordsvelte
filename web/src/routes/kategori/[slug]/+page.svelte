<script lang="ts">
  import { formatDate, formatExcerpt } from '$lib/utils'
  import { Clock } from '@lucide/svelte'

  let { data } = $props()
  let { category, posts } = $derived(data)

  let featured = $derived(posts[0])
  let subFeatured = $derived(posts.slice(1, 5))
  let rest = $derived(posts.slice(5))
</script>

<div class="mb-6">
  <!-- Subcategory Nav -->
  <div class="flex items-center gap-2 overflow-x-auto pb-2 mb-4 flex-wrap">
    <a href="/kategori/dunia" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Dunia</a>
    <a href="/kategori/event" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Event</a>
    <a href="/kategori/gaya-hidup" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Gaya Hidup</a>
    <a href="/kategori/hiburan" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Hiburan</a>
    <a href="/kategori/jawa-timur" class="text-xs px-3 py-1.5 rounded-full border bg-red-600 text-white border-red-600">Jawa Timur</a>
    <a href="/kategori/kediri-raya" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Kediri Raya</a>
    <a href="/kategori/nasional" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Nasional</a>
    <a href="/kategori/olahraga" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Olah Raga</a>
    <a href="/kategori/opini" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Opini</a>
    <a href="/kategori/religi" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Religi</a>
    <a href="/kategori/regional" class="text-xs px-3 py-1.5 rounded-full border hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors">Regional</a>
  </div>

  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <div>
      <div class="text-xs text-gray-500 mb-1">
        <a href="/" class="hover:text-red-600">Beranda</a>
        <span class="mx-1">/</span>
        <span class="text-gray-700 font-medium">{category.name}</span>
      </div>
      <h1 class="text-2xl font-bold text-gray-900">{category.name}</h1>
    </div>
    <select class="text-xs border rounded px-2 py-1.5 bg-white text-gray-600">
      <option>Terbaru</option>
      <option>Terpopuler</option>
      <option>Acak</option>
    </select>
  </div>
</div>

<!-- Featured Grid -->
{#if featured}
<section class="mb-8">
  <div class="grid lg:grid-cols-3 gap-2">
    <a href="/{featured.slug}" class="lg:col-span-2 group relative overflow-hidden rounded-lg aspect-video lg:aspect-auto lg:min-h-[400px]">
      {#if featured.featuredImageUrl}
        <img src={featured.featuredImageUrl} alt={featured.title} class="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-700" />
      {:else}
        <div class="w-full h-full absolute inset-0 bg-gray-800"></div>
      {/if}
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-6">
        <span class="inline-block bg-red-600 text-white text-xs font-bold px-2 py-1 mb-3 uppercase">{category.name}</span>
        <h2 class="text-white text-xl md:text-2xl font-bold leading-tight mb-2 group-hover:text-red-400 transition-colors">{featured.title}</h2>
        <div class="flex items-center gap-3 text-xs text-gray-300">
          <span class="flex items-center gap-1"><Clock class="h-3 w-3" /> {formatDate(featured.publishedAt || featured.createdAt)}</span>
        </div>
      </div>
    </a>
    <div class="grid grid-cols-2 gap-2">
      {#each subFeatured as post}
        <a href="/{post.slug}" class="group relative overflow-hidden rounded-lg aspect-[4/3]">
          {#if post.featuredImageUrl}
            <img src={post.featuredImageUrl} alt={post.title} class="w-full h-full object-cover absolute inset-0 group-hover:scale-105 transition-transform duration-700" />
          {:else}
            <div class="w-full h-full absolute inset-0 bg-gray-800"></div>
          {/if}
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          <div class="absolute bottom-0 left-0 right-0 p-3">
            <h3 class="text-white text-sm font-bold leading-snug line-clamp-2 group-hover:text-red-400 transition-colors">{post.title}</h3>
            <span class="text-gray-400 text-[10px] mt-1 block">{formatDate(post.publishedAt || post.createdAt)}</span>
          </div>
        </a>
      {/each}
    </div>
  </div>
</section>
{/if}

<!-- Article Grid -->
<div class="grid lg:grid-cols-3 gap-8">
  <div class="lg:col-span-2">
    {#if rest.length === 0 && posts.length <= 5}
      <p class="text-gray-500 text-sm py-8">Tidak ada artikel dalam kategori ini.</p>
    {:else if rest.length > 0 || subFeatured.length === 0}
      <div class="grid md:grid-cols-2 gap-4">
        {#each (rest.length > 0 ? rest : posts.slice(0)) as post}
          <article class="bg-white rounded-lg border overflow-hidden hover:shadow-md transition-shadow">
            <a href="/{post.slug}" class="aspect-video overflow-hidden bg-gray-100 block">
              {#if post.featuredImageUrl}
                <img src={post.featuredImageUrl} alt={post.title} class="w-full h-full object-cover hover:scale-105 transition-transform" />
              {/if}
            </a>
            <div class="p-4">
              <h3 class="font-bold text-sm leading-snug mb-1">
                <a href="/{post.slug}" class="hover:text-red-600 transition-colors">{post.title}</a>
              </h3>
              <div class="text-xs text-gray-500 mb-2">
                <span>{formatDate(post.publishedAt || post.createdAt)}</span>
                <span class="mx-1">-</span>
                <span class="text-red-600">WordSvelte</span>
              </div>
              <p class="text-xs text-gray-600 line-clamp-3">{formatExcerpt(post.excerpt || post.content, 120)}</p>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Sidebar -->
  <aside class="space-y-6">
    <div class="bg-white rounded-lg border">
      <h3 class="font-bold text-sm uppercase text-gray-900 px-4 pt-4 pb-2">Berita Populer</h3>
      <div class="divide-y">
        {#each posts.slice(0, 5) as pop, i}
          <a href="/{pop.slug}" class="flex gap-3 px-4 py-3 hover:bg-gray-50">
            <span class="text-2xl font-bold text-gray-200 shrink-0 w-8">{i + 1}</span>
            <div class="min-w-0">
              <h4 class="text-sm font-medium leading-snug line-clamp-2 hover:text-red-600">{pop.title}</h4>
              <span class="text-xs text-gray-500 mt-1 block">{formatDate(pop.publishedAt || pop.createdAt)}</span>
            </div>
          </a>
        {/each}
      </div>
    </div>
  </aside>
</div>
