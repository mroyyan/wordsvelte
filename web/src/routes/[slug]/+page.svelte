<script lang="ts">
  import { formatDate, formatExcerpt } from '$lib/utils'
  import { page } from '$app/stores'
  import { Clock, Eye, MessageSquare, Share2, Tag, ChevronRight } from '@lucide/svelte'
  import WidgetRenderer from '$lib/components/widgets/widget-renderer.svelte'

  let { data } = $props()
  let { post, comments } = $derived(data)
  let tags: { id: number; name: string; slug: string }[] = $derived((data.tags || []) as any)
  let sidebarWidgets = $derived($page.data.widgets?.filter((w: any) => w.sidebarArea === 'sidebar-1') || [])

  let commentText = $state('')
  let commentName = $state('')
  let commentEmail = $state('')
  let submitting = $state(false)
  let commentError = $state('')
  let commentSuccess = $state(false)

  async function handleCommentSubmit(e: Event) {
    e.preventDefault()
    if (!commentText.trim() || !commentName.trim() || !commentEmail.trim()) return
    submitting = true; commentError = ''; commentSuccess = false
    try {
      const res = await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, authorName: commentName, authorEmail: commentEmail, content: commentText })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Gagal')
      commentSuccess = true; commentText = ''; commentName = ''; commentEmail = ''
    } catch (e: any) { commentError = e.message }
    finally { submitting = false }
  }
</script>

<div class="grid lg:grid-cols-3 gap-8">
  <div class="lg:col-span-2">
    <article class="bg-white rounded-lg border overflow-hidden">
      <div class="px-6 pt-6 pb-2">
        <nav class="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <a href="/" class="hover:text-red-600">Beranda</a>
          <ChevronRight class="h-3 w-3" />
          <span class="text-gray-400 truncate max-w-[200px]">{post.title}</span>
        </nav>
        <h1 class="text-2xl md:text-3xl font-bold leading-tight text-gray-900">{post.title}</h1>
        <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-3 pb-4 border-b">
          <span class="font-medium text-gray-700">Penulis: <span class="text-red-600 font-normal">WordSvelte</span></span>
          <span class="flex items-center gap-1"><Clock class="h-3 w-3" /> {formatDate(post.publishedAt || post.createdAt)}</span>
          <span class="flex items-center gap-1"><Eye class="h-3 w-3" /> {post.viewCount || 0}</span>
          <span class="flex items-center gap-1"><MessageSquare class="h-3 w-3" /> {comments.length}</span>
        </div>
      </div>

      {#if post.featuredImageUrl}
        <div class="px-6 pt-4">
          <img src={post.featuredImageUrl} alt={post.title} class="w-full rounded-lg" />
        </div>
      {/if}

      <div class="px-6 py-6">
        <div class="post-content text-gray-800 leading-relaxed text-[15px] space-y-4">
          {@html post.content}
        </div>

        <div class="flex items-center gap-2 mt-8 pt-4 border-t">
          <Tag class="h-3.5 w-3.5 text-gray-400" />
          <span class="text-xs font-bold text-gray-600 uppercase">Topik</span>
          <div class="flex flex-wrap gap-1">
            {#each tags as tag}
              <a href="/tag/{tag.slug}" class="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded transition-colors">{tag.name}</a>
            {/each}
          </div>
        </div>

        <div class="flex items-center gap-2 mt-4">
          <Share2 class="h-4 w-4 text-gray-500" />
          <button class="bg-[#1877f2] text-white text-xs px-3 py-1.5 rounded font-medium hover:opacity-90">Facebook</button>
          <button class="bg-black text-white text-xs px-3 py-1.5 rounded font-medium hover:opacity-90">X</button>
          <button class="bg-[#25d366] text-white text-xs px-3 py-1.5 rounded font-medium hover:opacity-90">WhatsApp</button>
        </div>

        <div class="flex gap-4 mt-8 p-4 bg-gray-50 rounded-lg border">
          <div class="w-16 h-16 rounded-full bg-gray-200 shrink-0 overflow-hidden">
            <img src="https://secure.gravatar.com/avatar/94b1f7ab91df21de82cc1bbfedb4bd1859bf805a9c3e841d8aeaf6702257ed36?s=96&d=mm&r=g" alt="WordSvelte" class="w-full h-full object-cover" />
          </div>
          <div>
            <div class="font-bold text-sm text-gray-900">WordSvelte</div>
            <p class="text-xs text-gray-500 mt-1">WordSvelte is a simple, lightweight and modern static site generator. It is built with Svelte and Vite.</p>
            <div class="flex gap-2 mt-2">
              <a href="https://facebook.com" target="_blank" aria-label="Facebook" class="text-gray-400 hover:text-[#1877f2]"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
              <a href="https://twitter.com" target="_blank" aria-label="Twitter" class="text-gray-400 hover:text-black"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
              <a href="https://wa.me/628113454000" target="_blank" aria-label="WhatsApp" class="text-gray-400 hover:text-[#25d366]"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>
              <a href="https://youtube.com" target="_blank" aria-label="Youtube" class="text-gray-400 hover:text-red-600"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
            </div>
          </div>
        </div>
      </div>
    </article>

    <div class="bg-white rounded-lg border mt-6">
      <div class="px-6 py-4 border-b"><h3 class="font-bold text-sm uppercase text-gray-900">Artikel Terkait</h3></div>
      <div class="grid md:grid-cols-3 divide-x">
        {#each data.related || [] as related}
          <a href="/{related.slug}" class="p-4 hover:bg-gray-50 group">
            <div class="aspect-video bg-gray-100 rounded-md overflow-hidden mb-2">
              <img src={related.featuredImageUrl} alt={related.title} class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            </div>
            <h4 class="text-sm font-medium leading-snug line-clamp-2 group-hover:text-red-600">{related.title}</h4>
            <span class="text-xs text-gray-500 mt-1 block">{formatDate(related.publishedAt || related.createdAt)}</span>
          </a>
        {/each}
      </div>
    </div>

    <section class="bg-white rounded-lg border mt-6">
      <div class="px-6 py-4 border-b"><h3 class="font-bold text-sm uppercase text-gray-900">{comments.length} Komentar</h3></div>
      {#if comments.length === 0}
        <p class="px-6 py-8 text-sm text-gray-500 text-center">Belum ada komentar. Jadilah yang pertama!</p>
      {:else}
        <div class="divide-y">
          {#each comments as comment}
            <div class="px-6 py-5 {comment.parentId ? 'ml-10 border-l-2 border-red-100' : ''}">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-600 shrink-0">{comment.authorName?.charAt(0)?.toUpperCase() || '?'}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold text-gray-900">{comment.authorName}</span>
                    {#if comment.parentId}<span class="text-xs text-red-500 font-medium">• Balasan</span>{/if}
                    <span class="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                  </div>
                  <div class="mt-1 text-sm text-gray-700 leading-relaxed">{@html comment.content?.replace(/\n/g, '<br>')}</div>
                  <button class="text-xs text-gray-500 hover:text-red-600 font-medium mt-2">Balas</button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
      <div class="px-6 py-6 border-t bg-gray-50 rounded-b-lg">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">K</div>
          <h4 class="font-bold text-sm text-gray-900">Tinggalkan Komentar</h4>
        </div>
        <form class="space-y-3" onsubmit={handleCommentSubmit}>
          <textarea bind:value={commentText} placeholder="Tulis komentar Anda di sini..." required class="w-full border rounded-lg p-4 text-sm min-h-[120px] focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none resize-none bg-white placeholder:text-gray-400"></textarea>
          <div class="grid md:grid-cols-2 gap-3">
            <input bind:value={commentName} placeholder="Nama Lengkap *" required class="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none bg-white placeholder:text-gray-400" />
            <input bind:value={commentEmail} type="email" placeholder="Alamat Email *" required class="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none bg-white placeholder:text-gray-400" />
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" id="save-info" class="rounded border-gray-300" />
            <label for="save-info">Simpan nama dan email untuk komentar saya selanjutnya.</label>
          </div>
          <button type="submit" class="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors" disabled={submitting}>
            {submitting ? 'Mengirim...' : 'Kirim Komentar'}
          </button>
          {#if commentError}<p class="text-red-600 text-sm">{commentError}</p>{/if}
          {#if commentSuccess}<p class="text-green-600 text-sm">Komentar berhasil dikirim!</p>{/if}
        </form>
      </div>
    </section>
  </div>
  <aside class="space-y-6">
    {#each sidebarWidgets as widget (widget.id)}
      <div class="bg-white rounded-lg border p-4">
        <WidgetRenderer {widget} posts={data.popular || []} categories={data.categories || []} tags={data.tags || []} />
      </div>
    {/each}
  </aside>
</div>

<style>
  :global(.post-content p) { margin-bottom: 1rem; line-height: 1.8; }
  :global(.post-content strong) { font-weight: 700; }
  :global(.post-content img) { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1.5rem 0; }
</style>
