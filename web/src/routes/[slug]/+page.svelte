<script lang="ts">
  import { t } from '$lib/i18n'
  import { onMount, tick } from 'svelte'
  import { formatExcerpt } from '$lib/utils'
  import { formatDate } from '$lib/shared/format'
  import Seo from '$lib/components/site/seo.svelte'
  import { snippet } from '$lib/shared/seo'
  import { splitAfterParagraph } from '$lib/shared/ads'
  import AdSlot from '$lib/components/site/ad-slot.svelte'
  import { page } from '$app/stores'
  import { Clock, Eye, MessageSquare, Share2, Tag, ChevronRight, X } from '@lucide/svelte'
  import WidgetRenderer from '$lib/components/site/widgets/widget-renderer.svelte'

  let { data } = $props()
  let { post, comments } = $derived(data as any)
  let postTags: { id: number; name: string; slug: string }[] = $derived((data.postTags || []) as any)
  let allTags = $derived(data.tags || [])
  let sidebarWidgets = $derived($page.data.widgets?.filter((w: any) => w.sidebarArea === 'sidebar-1') || [])
  let stickySidebar = $derived($page.data.settings?.sticky_sidebar === 'true')
  // an ad inside the article, after its second paragraph (only when such an ad is running and the article is long enough)
  let inArticle = $derived($page.data.ads?.['in-article']?.length && post?.content ? splitAfterParagraph(post.content, 2) : null)

  let commentText = $state('')
  let requireIdentity = $derived($page.data.settings?.comments_require_name_email !== 'false')
  let commentName = $state('')
  let commentEmail = $state('')

  onMount(() => {
    document.querySelectorAll<HTMLElement>('.post-content pre').forEach((pre) => {
      const btn = document.createElement('button')
      btn.className = 'copy-btn'
      btn.textContent = t('post.copy')
      btn.onclick = () => {
        const code = pre.querySelector('code')
        navigator.clipboard.writeText(code?.textContent || pre.textContent || '')
        btn.textContent = t('post.copied')
        setTimeout(() => { btn.textContent = t('post.copy') }, 2000)
      }
      pre.style.position = 'relative'
      pre.appendChild(btn)
    })
  })
  type CommentRow = { id: number; parentId: number | null; authorName: string; content: string; createdAt: string }

  /**
   * Comments as threads: a top-level comment and everything below it. Replies of any depth sit in one flat, indented list under their thread
   * (deeper nesting only squeezes the text on a phone); a reply to another reply says whom it answers. A reply whose parent is not
   * shown (not approved yet) stands on its own.
   */
  const threads = $derived.by(() => {
    const list = ((comments ?? []) as CommentRow[])
    const ids = new Set(list.map(c => c.id))
    const children = new Map<number, CommentRow[]>()
    const roots: CommentRow[] = []
    for (const c of list) {
      if (c.parentId && c.parentId !== c.id && ids.has(c.parentId)) children.set(c.parentId, [...(children.get(c.parentId) ?? []), c])
      else roots.push(c)
    }
    const flatten = (root: CommentRow) => {
      const out: { c: CommentRow; to: string | null }[] = []
      const walk = (parent: CommentRow, depth: number) => {
        for (const reply of children.get(parent.id) ?? []) { out.push({ c: reply, to: depth > 0 ? parent.authorName : null }); walk(reply, depth + 1) }
      }
      walk(root, 0)
      return out
    }
    return roots.map(root => ({ root, replies: flatten(root) }))
  })

  // "Reply" fills this; the form then sends the comment as an answer to it
  let replyingTo = $state<{ id: number; name: string } | null>(null)
  async function startReply(c: CommentRow) {
    replyingTo = { id: c.id, name: c.authorName }
    await tick()
    document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    document.getElementById('comment-text')?.focus({ preventScroll: true })
  }

  let submitting = $state(false)
  let commentError = $state('')
  let commentSuccess = $state(false)

  async function handleCommentSubmit(e: Event) {
    e.preventDefault()
    if (!commentText.trim() || (requireIdentity && (!commentName.trim() || !commentEmail.trim()))) return
    submitting = true; commentError = ''; commentSuccess = false
    try {
      const res = await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, authorName: commentName, authorEmail: commentEmail, content: commentText, parentId: replyingTo?.id })
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || t('post.commentFailed'))
      commentSuccess = true; replyingTo = null; commentText = ''; commentName = ''; commentEmail = ''
    } catch (e: any) { commentError = e.message }
    finally { submitting = false }
  }
</script>

{#if data.kind === 'page'}
  <Seo
    title={data.page.title}
    description={snippet(data.page.content)}
    modifiedAt={data.page.updatedAt}
    webPage
    breadcrumbs={[{ name: data.page.title, path: `/${data.page.slug}` }]}
  />
{:else}
  <Seo
    title={post.title}
    description={post.excerpt || snippet(post.content)}
    image={post.featuredImageUrl}
    type="article"
    publishedAt={post.publishedAt || post.createdAt}
    modifiedAt={post.updatedAt}
    authorName={data.authorName}
    section={data.postCategories?.[0]?.name}
    tags={postTags.map(t => t.name)}
    breadcrumbs={[
      ...(data.postCategories?.[0] ? [{ name: data.postCategories[0].name, path: `/kategori/${data.postCategories[0].slug}` }] : []),
      { name: post.title, path: `/${post.slug}` },
    ]}
  />
{/if}

{#if data.kind === 'page'}
  <div class="grid lg:grid-cols-3 gap-8">
    <div class="lg:col-span-2">
      <article class="panel overflow-hidden">
        <div class="md:px-6 pt-6 pb-2">
          <nav class="flex items-center gap-1 text-xs text-gray-500 mb-3">
            <a href="/" class="hover:text-red-600">{t('common.home')}</a>
            <ChevronRight class="h-3 w-3" />
            <span class="text-gray-400 truncate max-w-[200px]">{data.page.title}</span>
          </nav>
          <h1 class="text-xl md:text-3xl font-bold leading-tight text-gray-900 pb-4 border-b">{data.page.title}</h1>
        </div>
        <div class="md:px-6 py-6">
          <div class="post-content text-gray-800 leading-relaxed text-[14px] md:text-[15px] space-y-4">
            {@html data.page.content}
          </div>
        </div>
      </article>
    </div>
    <aside class="space-y-6 max-md:border-t max-md:pt-6 {stickySidebar ? 'lg:sticky lg:top-20 lg:self-start' : ''}">
      <AdSlot placement="sidebar-top" />
      {#each sidebarWidgets as widget (widget.id)}
        <div class="panel md:p-4">
          <WidgetRenderer {widget} categories={data.categories || []} tags={data.tags || []} />
        </div>
      {/each}
      <AdSlot placement="sidebar-bottom" />
    </aside>
  </div>
{:else}
<div class="grid lg:grid-cols-3 gap-8">
  <div class="lg:col-span-2">
    <article class="panel overflow-hidden">
      <div class="md:px-6 pt-6 pb-2">
        <nav class="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <a href="/" class="hover:text-red-600">{t('common.home')}</a>
          <ChevronRight class="h-3 w-3" />
          <span class="text-gray-400 truncate max-w-[200px]">{post.title}</span>
        </nav>
        <h1 class="text-xl md:text-3xl font-bold leading-tight text-gray-900">{post.title}</h1>
        <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-3 pb-4 border-b">
          <span class="font-medium text-gray-700">{t('post.author')} <span class="text-red-600 font-normal">WordSvelte</span></span>
          <span class="flex items-center gap-1"><Clock class="h-3 w-3" /> {formatDate(post.publishedAt || post.createdAt)}</span>
          <span class="flex items-center gap-1"><Eye class="h-3 w-3" /> {post.viewCount || 0}</span>
          <span class="flex items-center gap-1"><MessageSquare class="h-3 w-3" /> {comments.length}</span>
        </div>
      </div>

      {#if post.featuredImageUrl}
        <div class="md:px-6 pt-4">
          <img src={post.featuredImageUrl} alt={post.title} class="w-full rounded-lg" />
        </div>
      {/if}

      <div class="md:px-6 py-6">
        <AdSlot placement="article-top" class="mb-6" />
        <div class="post-content text-gray-800 leading-relaxed text-[14px] md:text-[15px] space-y-4">
          {#if inArticle}
            {@html inArticle.head}
            <AdSlot placement="in-article" class="my-6" />
            {@html inArticle.tail}
          {:else}
            {@html post.content}
          {/if}
        </div>
        <AdSlot placement="article-bottom" class="mt-8" />

        <div class="flex items-center gap-2 mt-8 pt-4 border-t">
          <Tag class="h-3.5 w-3.5 text-gray-400" />
          <span class="text-xs font-bold text-gray-600 uppercase">{t('post.topics')}</span>
          <div class="flex flex-wrap gap-1">
            {#each postTags as tag}
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

        <div class="mt-8 flex gap-4 max-md:border-t max-md:pt-6 md:rounded-lg md:border md:bg-gray-50 md:p-4">
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

    <div class="panel mt-6">
      <div class="md:px-6 py-4 border-b"><h3 class="font-bold text-sm uppercase text-gray-900">{t('post.related')}</h3></div>
      <div class="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
        {#each data.related || [] as related}
          <!-- phones: thumbnail beside the title; wider screens: card with the image on top -->
          <a href="/{related.slug}" class="group flex gap-3 p-4 hover:bg-gray-50 md:block">
            <div class="mb-0 aspect-square w-24 shrink-0 self-start overflow-hidden rounded-md bg-gray-100 md:mb-2 md:aspect-video md:w-full">
              {#if related.featuredImageUrl}
                <img src={related.featuredImageUrl} alt="" class="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              {/if}
            </div>
            <div class="min-w-0">
              <h4 class="text-sm font-medium leading-snug line-clamp-3 group-hover:text-red-600 md:line-clamp-2">{related.title}</h4>
              <span class="text-xs text-gray-500 mt-1 block">{formatDate(related.publishedAt || related.createdAt)}</span>
            </div>
          </a>
        {/each}
      </div>
    </div>

    <section class="panel mt-6">
      <div class="md:px-6 py-4 border-b"><h3 class="font-bold text-sm uppercase text-gray-900">{t('post.comments', { n: comments.length })}</h3></div>
      {#if comments.length === 0}
        <p class="md:px-6 py-8 text-sm text-gray-500 text-center">{t('post.noComments')}</p>
      {:else}
        {#snippet commentItem(c: CommentRow, to: string | null, small: boolean)}
          <div class="flex gap-3">
            <div class="flex shrink-0 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-600 {small ? 'size-8 text-xs' : 'size-10 text-sm'}" aria-hidden="true">{c.authorName?.charAt(0)?.toUpperCase() || '?'}</div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="text-sm font-semibold text-gray-900">{c.authorName}</span>
                {#if to}<span class="text-xs text-gray-500">{t('post.replyingTo', { name: to })}</span>{/if}
                <span class="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
              </div>
              <div class="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-gray-700">{c.content}</div>
              <button type="button" class="mt-1.5 text-xs font-medium text-gray-500 hover:text-red-600" onclick={() => startReply(c)}>{t('post.reply')}</button>
            </div>
          </div>
        {/snippet}

        <div class="divide-y">
          {#each threads as thread (thread.root.id)}
            <article class="py-5 md:px-6">
              {@render commentItem(thread.root, null, false)}
              {#if thread.replies.length}
                <!-- one thin neutral line under the avatar ties the answers to their comment -->
                <div class="ml-5 mt-4 space-y-4 border-l border-gray-200 pl-4 sm:pl-6">
                  {#each thread.replies as reply (reply.c.id)}
                    {@render commentItem(reply.c, reply.to, true)}
                  {/each}
                </div>
              {/if}
            </article>
          {/each}
        </div>
      {/if}
      <div id="comment-form" class="py-6 border-t md:px-6 md:bg-gray-50 rounded-b-lg">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white">K</div>
          <h4 class="font-bold text-sm text-gray-900">{t('post.leaveComment')}</h4>
        </div>
        <form class="space-y-3" onsubmit={handleCommentSubmit}>
          {#if replyingTo}
            <div class="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm text-gray-600">
              <span class="min-w-0 truncate">{t('post.replyingTo', { name: replyingTo.name })}</span>
              <button type="button" class="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700" aria-label={t('post.cancelReply')} onclick={() => (replyingTo = null)}><X class="h-4 w-4" /></button>
            </div>
          {/if}
          <textarea id="comment-text" bind:value={commentText} placeholder={t('post.commentPlaceholder')} required class="w-full border rounded-lg p-4 text-sm min-h-[120px] focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none resize-none bg-white placeholder:text-gray-400"></textarea>
          <div class="grid md:grid-cols-2 gap-3">
            <input bind:value={commentName} placeholder={requireIdentity ? t('post.nameRequired') : t('post.nameOptional')} required={requireIdentity} class="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none bg-white placeholder:text-gray-400" />
            <input bind:value={commentEmail} type="email" placeholder={requireIdentity ? t('post.emailRequired') : t('post.emailOptional')} required={requireIdentity} class="w-full border rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none bg-white placeholder:text-gray-400" />
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" id="save-info" class="rounded border-gray-300" />
            <label for="save-info">{t('post.remember')}</label>
          </div>
          <button type="submit" class="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors" disabled={submitting}>
            {submitting ? t('post.sending') : t('post.submitComment')}
          </button>
          {#if commentError}<p class="text-red-600 text-sm">{commentError}</p>{/if}
          {#if commentSuccess}<p class="text-green-600 text-sm">{t('post.commentSent')}</p>{/if}
        </form>
      </div>
    </section>
  </div>
  <aside class="space-y-6 max-md:border-t max-md:pt-6 {stickySidebar ? 'lg:sticky lg:top-20 lg:self-start' : ''}">
    <AdSlot placement="sidebar-top" />
    {#each sidebarWidgets as widget (widget.id)}
      <div class="panel md:p-4">
        <WidgetRenderer {widget} categories={data.categories || []} tags={data.tags || []} />
      </div>
    {/each}
    <AdSlot placement="sidebar-bottom" />
  </aside>
</div>
{/if}

<style>
  :global(.post-content p) { margin: 1.25rem 0; line-height: 1.8; }
  :global(.post-content strong) { font-weight: 700; }
  :global(.post-content img) { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1.5rem 0; }
  :global(.post-content ul),
  :global(.post-content ol) { margin: 1rem 0; padding-left: 1.5em; }
  :global(.post-content ul) { list-style-type: disc; }
  :global(.post-content ul ul) { list-style-type: circle; }
  :global(.post-content ul ul ul) { list-style-type: square; }
  :global(.post-content ol) { list-style-type: decimal; }
  :global(.post-content ol ol) { list-style-type: lower-alpha; }
  :global(.post-content li) { margin: 0.35em 0; line-height: 1.8; }
  :global(.post-content li > ul),
  :global(.post-content li > ol) { margin: 0.35em 0; }
  :global(.post-content blockquote) {
    border-left: 4px solid #e5e7eb;
    margin: 1.5rem 0;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-radius: 0 0.5rem 0.5rem 0;
    color: #6b7280;
    font-style: italic;
  }
  :global(.post-content h1) { font-size: 2em; font-weight: 700; line-height: 1.2; margin: 1em 0 0.5em; }
  :global(.post-content h2) { font-size: 1.5em; font-weight: 700; line-height: 1.3; margin: 1em 0 0.5em; }
  :global(.post-content h3) { font-size: 1.25em; font-weight: 600; line-height: 1.4; margin: 1em 0 0.5em; }
  :global(.post-content a) { color: #dc2626; text-decoration: underline; }
  :global(.post-content a:hover) { color: #b91c1c; }
  :global(.post-content table) { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
  :global(.post-content th),
  :global(.post-content td) { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; }
  :global(.post-content th) { background: #f9fafb; font-weight: 600; }
  :global(.post-content code) {
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    background: #f1f5f9;
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-size: 0.9em;
    color: #e11d48;
  }
  :global(.post-content pre) {
    background: #0f172a;
    color: #e2e8f0;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    padding: 1.25em 1.5em;
    border-radius: 0.75rem;
    overflow-x: auto;
    margin: 1.5rem 0;
    line-height: 1.7;
    font-size: 0.875em;
    border: 1px solid #1e293b;
    position: relative;
    scrollbar-width: thin;
    scrollbar-color: #334155 #0f172a;
  }
  :global(.post-content pre::-webkit-scrollbar) {
    height: 6px;
  }
  :global(.post-content pre::-webkit-scrollbar-track) {
    background: #0f172a;
    border-radius: 3px;
  }
  :global(.post-content pre::-webkit-scrollbar-thumb) {
    background: #334155;
    border-radius: 3px;
  }
  :global(.post-content pre::-webkit-scrollbar-thumb:hover) {
    background: #475569;
  }
  :global(.post-content pre code) {
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: inherit;
    color: inherit;
  }
  :global(.post-content pre .copy-btn) {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: #1e293b;
    color: #94a3b8;
    border: 1px solid #334155;
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.7rem;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s, background 0.2s, color 0.2s;
  }
  :global(.post-content pre:hover .copy-btn) {
    opacity: 1;
  }
  :global(.post-content pre .copy-btn:hover) {
    background: #334155;
    color: #e2e8f0;
  }
</style>
