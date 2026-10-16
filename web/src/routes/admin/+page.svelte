<script lang="ts">
  import { onMount } from 'svelte'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import FilePenLineIcon from '@lucide/svelte/icons/file-pen-line'
  import MessageSquareIcon from '@lucide/svelte/icons/message-square'
  import ImageIcon from '@lucide/svelte/icons/image'
  import FileStackIcon from '@lucide/svelte/icons/file-stack'
  import FolderTreeIcon from '@lucide/svelte/icons/folder-tree'
  import TagsIcon from '@lucide/svelte/icons/tags'
  import UsersIcon from '@lucide/svelte/icons/users'
  import TrendingUpIcon from '@lucide/svelte/icons/trending-up'
  import TrendingDownIcon from '@lucide/svelte/icons/trending-down'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import { api, errorMessage } from '$lib/client/admin-api'
  import { formatDate } from '$lib/utils'

  interface Dashboard {
    scope: 'own' | 'site'
    totals: { posts: number; published: number; drafts: number; pending: number; views: number; media: number; pages?: number; categories?: number; tags?: number; comments?: number; pendingComments?: number; users?: number }
    postsPerMonth: { month: string; count: number }[]
    monthDelta: { thisMonth: number; lastMonth: number; difference: number }
    topPosts: { id: number; title: string; slug: string; viewCount: number }[]
    recentPosts: { id: number; title: string; status: string; date: string; authorName: string | null }[]
    recentComments?: { id: number; authorName: string; content: string; status: string; createdAt: string; postTitle: string | null }[]
  }

  let data = $state<Dashboard | null>(null)
  let error = $state('')

  onMount(async () => {
    try { data = await api<Dashboard>('/api/dashboard') } catch (e) { error = errorMessage(e) }
  })

  const nf = new Intl.NumberFormat('id-ID')
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('id-ID', { month: 'short', timeZone: 'UTC' })
  const monthFull = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const maxCount = $derived(Math.max(1, ...(data?.postsPerMonth.map(m => m.count) ?? [0])))
  const hasChartData = $derived((data?.postsPerMonth.some(m => m.count > 0)) ?? false)
  const maxViews = $derived(Math.max(1, ...(data?.topPosts.map(p => p.viewCount) ?? [0])))
  const siteWide = $derived(data?.scope === 'site')

  const statusStyle: Record<string, string> = {
    publish: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    pending: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900',
    approved: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    spam: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
    trash: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  }
  const statusLabel: Record<string, string> = { publish: 'Published', pending: 'Pending', draft: 'Draft', approved: 'Approved', spam: 'Spam', trash: 'Trash' }

  const shortcuts = $derived(!data || !siteWide ? [] : [
    { label: 'Pages', value: data.totals.pages, href: '/admin/pages', icon: FileStackIcon },
    { label: 'Categories', value: data.totals.categories, href: '/admin/categories', icon: FolderTreeIcon },
    { label: 'Tags', value: data.totals.tags, href: '/admin/tags', icon: TagsIcon },
    { label: 'Media files', value: data.totals.media, href: '/admin/media', icon: ImageIcon },
    ...(data.totals.users !== undefined ? [{ label: 'Users', value: data.totals.users, href: '/admin/users', icon: UsersIcon }] : []),
  ])
</script>

<svelte:head><title>Dashboard</title></svelte:head>

<PageHeader
  title="Dashboard"
  description={data?.scope === 'own' ? 'An overview of your own posts' : 'An overview of your newsroom'}
/>

{#if error}
  <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
{:else if !data}
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each Array(4) as _, i (i)}<Skeleton class="h-32 rounded-xl" />{/each}
  </div>
  <div class="mt-4 grid gap-4 lg:grid-cols-7">
    <Skeleton class="h-80 rounded-xl lg:col-span-4" /><Skeleton class="h-80 rounded-xl lg:col-span-3" />
  </div>
{:else}
  <div class="space-y-4">
    <!-- headline numbers -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Total Views</CardTitle>
          <EyeIcon class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{nf.format(data.totals.views)}</div>
          <p class="text-xs text-muted-foreground">Page views across published posts</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Published Posts</CardTitle>
          <FileTextIcon class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{nf.format(data.totals.published)}</div>
          <p class="flex items-center gap-1 text-xs text-muted-foreground">
            {#if data.monthDelta.difference > 0}
              <TrendingUpIcon class="size-3.5 text-green-600" /> <span class="text-green-600">+{data.monthDelta.difference}</span>
            {:else if data.monthDelta.difference < 0}
              <TrendingDownIcon class="size-3.5 text-red-600" /> <span class="text-red-600">{data.monthDelta.difference}</span>
            {/if}
            {data.monthDelta.thisMonth} this month, {data.monthDelta.lastMonth} last month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">In Progress</CardTitle>
          <FilePenLineIcon class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{nf.format(data.totals.drafts + data.totals.pending)}</div>
          <p class="text-xs text-muted-foreground">{data.totals.drafts} draft{data.totals.drafts === 1 ? '' : 's'}, {data.totals.pending} pending review</p>
        </CardContent>
      </Card>

      {#if siteWide}
        <a href="/admin/comments" class="block rounded-xl transition-shadow hover:shadow-md">
          <Card class="h-full">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">Comments to Review</CardTitle>
              <MessageSquareIcon class="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{nf.format(data.totals.pendingComments ?? 0)}</div>
              <p class="text-xs text-muted-foreground">{nf.format(data.totals.comments ?? 0)} comments in total</p>
            </CardContent>
          </Card>
        </a>
      {:else}
        <a href="/admin/media" class="block rounded-xl transition-shadow hover:shadow-md">
          <Card class="h-full">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">My Uploads</CardTitle>
              <ImageIcon class="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{nf.format(data.totals.media)}</div>
              <p class="text-xs text-muted-foreground">Images in the media library</p>
            </CardContent>
          </Card>
        </a>
      {/if}
    </div>

    <!-- chart + popular posts -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-7">
      <Card class="lg:col-span-4">
        <CardHeader>
          <CardTitle>Posts Published</CardTitle>
          <CardDescription>Last 12 months</CardDescription>
        </CardHeader>
        <CardContent>
          {#if !hasChartData}
            <div class="flex h-64 items-center justify-center text-sm text-muted-foreground">No posts were published in the last 12 months.</div>
          {:else}
            <div class="flex h-64 items-end gap-2" role="img" aria-label="Posts published per month">
              {#each data.postsPerMonth as m (m.month)}
                <div class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title="{monthFull(m.month)}: {m.count} post{m.count === 1 ? '' : 's'}">
                  <span class="text-[10px] text-muted-foreground tabular-nums">{m.count || ''}</span>
                  <div class="w-full rounded-t bg-primary transition-all {m.count === 0 ? 'bg-muted' : ''}" style="height: {m.count === 0 ? 2 : Math.max(4, (m.count / maxCount) * 100)}%"></div>
                  <span class="text-[10px] text-muted-foreground">{monthLabel(m.month)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </CardContent>
      </Card>

      <Card class="lg:col-span-3">
        <CardHeader>
          <CardTitle>Most Viewed</CardTitle>
          <CardDescription>Top published posts by page views</CardDescription>
        </CardHeader>
        <CardContent>
          {#if data.topPosts.length === 0}
            <p class="py-8 text-center text-sm text-muted-foreground">No published posts yet.</p>
          {:else}
            <ol class="space-y-4">
              {#each data.topPosts as p, i (p.id)}
                <li class="flex items-center gap-3">
                  <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                  <div class="min-w-0 flex-1">
                    <a href={`/${p.slug}`} target="_blank" rel="noopener" class="block truncate text-sm font-medium hover:underline">{p.title}</a>
                    <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div class="h-full rounded-full bg-primary" style="width: {Math.max(3, (p.viewCount / maxViews) * 100)}%"></div></div>
                  </div>
                  <span class="shrink-0 text-sm text-muted-foreground tabular-nums">{nf.format(p.viewCount)}</span>
                </li>
              {/each}
            </ol>
          {/if}
        </CardContent>
      </Card>
    </div>

    <!-- shortcuts to the rest of the site -->
    {#if shortcuts.length}
      <div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {#each shortcuts as s (s.label)}
          <a href={s.href} class="flex items-center gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
            <span class="flex size-9 items-center justify-center rounded-lg bg-muted"><s.icon class="size-4" /></span>
            <span class="min-w-0">
              <span class="block text-lg leading-tight font-semibold tabular-nums">{nf.format(s.value ?? 0)}</span>
              <span class="block truncate text-xs text-muted-foreground">{s.label}</span>
            </span>
          </a>
        {/each}
      </div>
    {/if}

    <!-- recent activity -->
    <div class="grid grid-cols-1 gap-4 {siteWide ? 'lg:grid-cols-2' : ''}">
      <Card>
        <CardHeader>
          <CardTitle>Recent Posts</CardTitle>
          <CardDescription>{siteWide ? 'Latest activity across the site' : 'Your latest posts'}</CardDescription>
        </CardHeader>
        <CardContent>
          {#if data.recentPosts.length === 0}
            <p class="py-6 text-center text-sm text-muted-foreground">Nothing yet. <a href="/admin/posts/new" class="underline underline-offset-4">Write your first post</a>.</p>
          {:else}
            <ul class="divide-y">
              {#each data.recentPosts as p (p.id)}
                <li class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div class="min-w-0">
                    <a href={`/admin/posts/${p.id}`} class="block truncate text-sm font-medium hover:underline">{p.title}</a>
                    <p class="text-xs text-muted-foreground">{#if siteWide && p.authorName}{p.authorName} &middot; {/if}{formatDate(p.date)}</p>
                  </div>
                  <Badge variant="outline" class={statusStyle[p.status] ?? ''}>{statusLabel[p.status] ?? p.status}</Badge>
                </li>
              {/each}
            </ul>
          {/if}
        </CardContent>
      </Card>

      {#if siteWide}
        <Card>
          <CardHeader>
            <CardTitle>Recent Comments</CardTitle>
            <CardDescription><a href="/admin/comments" class="underline underline-offset-4">Moderate all comments</a></CardDescription>
          </CardHeader>
          <CardContent>
            {#if !data.recentComments?.length}
              <p class="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>
            {:else}
              <ul class="divide-y">
                {#each data.recentComments as c (c.id)}
                  <li class="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div class="min-w-0">
                      <p class="truncate text-sm"><span class="font-medium">{c.authorName}</span> <span class="text-muted-foreground">on {c.postTitle ?? 'a deleted post'}</span></p>
                      <!-- comments are untrusted text: rendered escaped, never as HTML -->
                      <p class="truncate text-xs text-muted-foreground">{c.content}</p>
                    </div>
                    <Badge variant="outline" class={statusStyle[c.status] ?? ''}>{statusLabel[c.status] ?? c.status}</Badge>
                  </li>
                {/each}
              </ul>
            {/if}
          </CardContent>
        </Card>
      {/if}
    </div>
  </div>
{/if}
