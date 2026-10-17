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
  import { tr, msg, formatAdminDate, adminLocale } from '$lib/i18n/admin'
  import { LANGUAGES } from '$lib/shared/format-date'

  interface Dashboard {
    scope: 'own' | 'site'
    totals: { posts: number; published: number; drafts: number; pending: number; scheduled: number; views: number; media: number; pages?: number; categories?: number; tags?: number; comments?: number; pendingComments?: number; users?: number }
    postsPerMonth: { month: string; count: number }[]
    viewsPerDay: { day: string; views: number }[]
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

  const locale = $derived(LANGUAGES.find(l => l.value === adminLocale())?.locale ?? 'id-ID')
  const nf = $derived(new Intl.NumberFormat(locale))
  const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const dayNumber = (d: string) => String(Number(d.slice(8)))

  const viewDays = $derived(data?.viewsPerDay ?? [])
  const maxDayViews = $derived(Math.max(1, ...viewDays.map(d => d.views)))
  const viewsTotal = $derived(viewDays.reduce((sum, d) => sum + d.views, 0))
  const hasViews = $derived(viewsTotal > 0)
  const maxViews = $derived(Math.max(1, ...(data?.topPosts.map(p => p.viewCount) ?? [0])))
  const siteWide = $derived(data?.scope === 'site')

  const statusStyle: Record<string, string> = {
    publish: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    scheduled: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
    pending: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900',
    approved: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    spam: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
    trash: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  }
  const statusLabel: Record<string, string> = { publish: msg('Published'), scheduled: msg('Scheduled'), pending: msg('Pending'), draft: msg('Draft'), approved: msg('Approved'), spam: msg('Spam'), trash: msg('Trash') }

  const shortcuts = $derived(!data || !siteWide ? [] : [
    { label: msg('Pages'), value: data.totals.pages, href: '/admin/pages', icon: FileStackIcon },
    { label: msg('Categories'), value: data.totals.categories, href: '/admin/categories', icon: FolderTreeIcon },
    { label: msg('Tags'), value: data.totals.tags, href: '/admin/tags', icon: TagsIcon },
    { label: msg('Media files'), value: data.totals.media, href: '/admin/media', icon: ImageIcon },
    ...(data.totals.users !== undefined ? [{ label: msg('Users'), value: data.totals.users, href: '/admin/users', icon: UsersIcon }] : []),
  ])
</script>

<svelte:head><title>{tr('Dashboard')}</title></svelte:head>

<PageHeader
  title={tr('Dashboard')}
  description={data?.scope === 'own' ? tr('An overview of your own posts') : tr('An overview of your newsroom')}

/>

{#if error}
  <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
{:else if !data}
  <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
    {#each Array(4) as _, i (i)}<Skeleton class="h-32 rounded-xl" />{/each}
  </div>
  <div class="mt-4 grid gap-4 lg:grid-cols-7">
    <Skeleton class="h-80 rounded-xl lg:col-span-4" /><Skeleton class="h-80 rounded-xl lg:col-span-3" />
  </div>
{:else}
  <div class="space-y-4">
    <!-- headline numbers -->
    <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">{tr('Total Views')}</CardTitle>
          <EyeIcon class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{nf.format(data.totals.views)}</div>
          <p class="text-xs text-muted-foreground">{tr('Page views across published posts')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">{tr('Published Posts')}</CardTitle>
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
            {tr('{thisMonth} this month, {lastMonth} last month', { thisMonth: data.monthDelta.thisMonth, lastMonth: data.monthDelta.lastMonth })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">{tr('In Progress')}</CardTitle>
          <FilePenLineIcon class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{nf.format(data.totals.drafts + data.totals.pending)}</div>
          <p class="text-xs text-muted-foreground">{data.totals.drafts === 1 ? tr('{drafts} draft, {pending} pending review, {scheduled} scheduled', { drafts: data.totals.drafts, pending: data.totals.pending, scheduled: data.totals.scheduled }) : tr('{drafts} drafts, {pending} pending review, {scheduled} scheduled', { drafts: data.totals.drafts, pending: data.totals.pending, scheduled: data.totals.scheduled })}</p>
        </CardContent>
      </Card>

      {#if siteWide}
        <a href="/admin/comments" class="block rounded-xl transition-shadow hover:shadow-md">
          <Card class="h-full">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">{tr('Comments to Review')}</CardTitle>
              <MessageSquareIcon class="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{nf.format(data.totals.pendingComments ?? 0)}</div>
              <p class="text-xs text-muted-foreground">{tr('{n} comments in total', { n: nf.format(data.totals.comments ?? 0) })}</p>
            </CardContent>
          </Card>
        </a>
      {:else}
        <a href="/admin/media" class="block rounded-xl transition-shadow hover:shadow-md">
          <Card class="h-full">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium">{tr('My Uploads')}</CardTitle>
              <ImageIcon class="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{nf.format(data.totals.media)}</div>
              <p class="text-xs text-muted-foreground">{tr('Images in the media library')}</p>
            </CardContent>
          </Card>
        </a>
      {/if}
    </div>

    <!-- chart + popular posts -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-7">
      <Card class="lg:col-span-4">
        <CardHeader>
          <CardTitle>{tr('Page Views')}</CardTitle>
          <CardDescription>{tr('Article views per day, last 30 days')}{hasViews ? ` · ${nf.format(viewsTotal)}` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {#if !hasViews}
            <div class="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">{tr('No article views yet. Views are counted from now on.')}</div>
          {:else}
            <div class="flex h-64 items-end gap-0.5 sm:gap-1" role="img" aria-label={tr('Article views per day')}>
              {#each viewDays as d, i (d.day)}
                <div class="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title="{dayLabel(d.day)}: {d.views === 1 ? tr('1 view') : tr('{n} views', { n: d.views })}">
                  <div class="w-full rounded-t bg-primary transition-all {d.views === 0 ? 'bg-muted' : ''}" style="height: {d.views === 0 ? 2 : Math.max(3, (d.views / maxDayViews) * 100)}%"></div>
                  <span class="h-3 text-[10px] leading-3 text-muted-foreground tabular-nums">{i % 5 === 0 || i === viewDays.length - 1 ? dayNumber(d.day) : ''}</span>
                </div>
              {/each}
            </div>
          {/if}
        </CardContent>
      </Card>

      <Card class="lg:col-span-3">
        <CardHeader>
          <CardTitle>{tr('Most Viewed')}</CardTitle>
          <CardDescription>{tr('Top published posts by page views')}</CardDescription>
        </CardHeader>
        <CardContent>
          {#if data.topPosts.length === 0}
            <p class="py-8 text-center text-sm text-muted-foreground">{tr('No published posts yet.')}</p>
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
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {#each shortcuts as s (s.label)}
          <a href={s.href} class="flex items-center gap-3 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
            <span class="flex size-9 items-center justify-center rounded-lg bg-muted"><s.icon class="size-4" /></span>
            <span class="min-w-0">
              <span class="block text-lg leading-tight font-semibold tabular-nums">{nf.format(s.value ?? 0)}</span>
              <span class="block truncate text-xs text-muted-foreground">{tr(s.label)}</span>
            </span>
          </a>
        {/each}
      </div>
    {/if}

    <!-- recent activity -->
    <div class="grid grid-cols-1 gap-4 {siteWide ? 'lg:grid-cols-2' : ''}">
      <Card>
        <CardHeader>
          <CardTitle>{tr('Recent Posts')}</CardTitle>
          <CardDescription>{siteWide ? tr('Latest activity across the site') : tr('Your latest posts')}</CardDescription>
        </CardHeader>
        <CardContent>
          {#if data.recentPosts.length === 0}
            <p class="py-6 text-center text-sm text-muted-foreground">{tr('Nothing yet.')} <a href="/admin/posts/new" class="underline underline-offset-4">{tr('Write your first post')}</a>.</p>
          {:else}
            <ul class="divide-y">
              {#each data.recentPosts as p (p.id)}
                <li class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div class="min-w-0">
                    <a href={`/admin/posts/${p.id}`} class="block truncate text-sm font-medium hover:underline">{p.title}</a>
                    <p class="text-xs text-muted-foreground">{#if siteWide && p.authorName}{p.authorName} &middot; {/if}{formatAdminDate(p.date)}</p>
                  </div>
                  <Badge variant="outline" class={statusStyle[p.status] ?? ''}>{statusLabel[p.status] ? tr(statusLabel[p.status]) : p.status}</Badge>
                </li>
              {/each}
            </ul>
          {/if}
        </CardContent>
      </Card>

      {#if siteWide}
        <Card>
          <CardHeader>
            <CardTitle>{tr('Recent Comments')}</CardTitle>
            <CardDescription><a href="/admin/comments" class="underline underline-offset-4">{tr('Moderate all comments')}</a></CardDescription>
          </CardHeader>
          <CardContent>
            {#if !data.recentComments?.length}
              <p class="py-6 text-center text-sm text-muted-foreground">{tr('No comments yet.')}</p>
            {:else}
              <ul class="divide-y">
                {#each data.recentComments as c (c.id)}
                  <li class="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div class="min-w-0">
                      <p class="truncate text-sm"><span class="font-medium">{c.authorName}</span> <span class="text-muted-foreground">{c.postTitle ? tr('on {title}', { title: c.postTitle }) : tr('on a deleted post')}</span></p>
                      <!-- comments are untrusted text: rendered escaped, never as HTML -->
                      <p class="truncate text-xs text-muted-foreground">{c.content}</p>
                    </div>
                    <Badge variant="outline" class={statusStyle[c.status] ?? ''}>{statusLabel[c.status] ? tr(statusLabel[c.status]) : c.status}</Badge>
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
