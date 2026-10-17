<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
  import SendIcon from '@lucide/svelte/icons/send'
  import ClockIcon from '@lucide/svelte/icons/clock'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import StarIcon from '@lucide/svelte/icons/star'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu'
  import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  } from '$lib/components/ui/alert-dialog'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import PrimaryButton from '$lib/components/layout/primary-button.svelte'
  import {
    DataTableState, DataTableToolbar, DataTableFacetedFilter, DataTableColumnHeader, DataTablePagination, DataTableBulkActions,
  } from '$lib/components/data-table'
  import { api, errorMessage, fetchAll, runBulk } from '$lib/client/admin-api'
  import { formatDate } from '$lib/utils'

  interface PostRow { id: number; title: string; slug: string; status: 'draft' | 'pending' | 'scheduled' | 'publish'; isFeatured: boolean; viewCount: number; createdAt: string; publishedAt: string | null }

  const statusOptions = [
    { label: 'Published', value: 'publish' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Pending review', value: 'pending' },
    { label: 'Draft', value: 'draft' },
  ]
  const statusLabel = (s: string) => statusOptions.find(o => o.value === s)?.label ?? s
  const statusColors: Record<string, string> = {
    publish: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    scheduled: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-900',
    pending: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900',
  }
  const columns = [
    { id: 'title', title: 'Title' },
    { id: 'status', title: 'Status' },
    { id: 'viewCount', title: 'Views' },
    { id: 'date', title: 'Date' },
  ]
  const postDate = (p: PostRow) => p.publishedAt || p.createdAt

  const table = new DataTableState<PostRow>({
    getId: p => p.id,
    searchFields: [p => p.title, p => p.slug],
    filterAccessors: { status: p => p.status },
    sortAccessors: { title: p => p.title, status: p => p.status, viewCount: p => p.viewCount, date: p => Date.parse(postDate(p)) || 0 },
  })

  let loading = $state(true)
  let error = $state('')
  let deleting = $state<PostRow[] | null>(null)
  let busy = $state(false)
  const visibleColumns = $derived(columns.filter(c => table.isVisible(c.id)))

  async function load() {
    loading = true; error = ''
    try { table.setRows(await fetchAll<PostRow>('/api/posts-admin', 500)) }
    catch (e) { error = errorMessage(e) } finally { loading = false }
  }
  onMount(load)

  async function setStatus(post: PostRow, status: PostRow['status']) {
    try {
      await api(`/api/posts-admin/${post.id}`, { method: 'PATCH', body: { status } })
      table.setRows(table.rows.map(r => (r.id === post.id ? { ...r, status } : r)))
      toast.success(status === 'publish' ? 'Post published' : 'Moved to draft')
    } catch (e) { toast.error(errorMessage(e)) }
  }

  async function bulkStatus(status: PostRow['status']) {
    busy = true
    const rows = table.selectedRows
    const { ok, failed, firstError } = await runBulk(rows, r => api(`/api/posts-admin/${r.id}`, { method: 'PATCH', body: { status } }))
    await load(); table.clearSelection(); busy = false
    if (failed) toast.error(`${ok} updated, ${failed} failed: ${firstError}`)
    else toast.success(`${ok} post${ok === 1 ? '' : 's'} ${status === 'publish' ? 'published' : 'moved to draft'}`)
  }

  async function confirmDelete() {
    const targets = deleting
    if (!targets) return
    deleting = null; busy = true
    const { ok, failed, firstError } = await runBulk(targets, r => api(`/api/posts-admin/${r.id}`, { method: 'DELETE' }))
    await load(); table.clearSelection(); busy = false
    if (failed) toast.error(`${ok} deleted, ${failed} failed: ${firstError}`)
    else toast.success(`${ok} post${ok === 1 ? '' : 's'} deleted`)
  }
</script>

<svelte:head><title>Posts</title></svelte:head>

<div class="flex flex-1 flex-col gap-4">
  <PageHeader title="Posts" description="Manage articles">
    {#snippet actions()}
      <PrimaryButton label="Add Post" icon={PlusIcon} onclick={() => goto('/admin/posts/new')} />
    {/snippet}
  </PageHeader>

  <DataTableToolbar {table} searchPlaceholder="Filter by title..." {columns}>
    {#snippet filters()}
      <DataTableFacetedFilter title="Status" options={statusOptions} selected={table.filters.status ?? []} counts={table.counts('status')} onChange={(v) => table.setFilter('status', v)} />
    {/snippet}
  </DataTableToolbar>

  {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}

  <div class="overflow-hidden rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-10"><Checkbox checked={table.allOnPageSelected} indeterminate={table.someOnPageSelected} onCheckedChange={() => table.toggleAllOnPage()} aria-label="Select all" class="translate-y-0.5" /></TableHead>
          {#each visibleColumns as c (c.id)}
            <TableHead><DataTableColumnHeader {table} column={c.id} title={c.title} /></TableHead>
          {/each}
          <TableHead class="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if loading}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center"><Loader2Icon class="mx-auto size-4 animate-spin text-muted-foreground" /></TableCell></TableRow>
        {:else if table.pageRows.length === 0}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center text-muted-foreground">{table.isFiltered ? 'No posts match your filters.' : 'No posts yet.'}</TableCell></TableRow>
        {:else}
          {#each table.pageRows as post (post.id)}
            <TableRow data-state={table.isSelected(post) ? 'selected' : undefined}>
              <TableCell><Checkbox checked={table.isSelected(post)} onCheckedChange={() => table.toggleRow(post)} aria-label="Select row" class="translate-y-0.5" /></TableCell>
              {#each visibleColumns as c (c.id)}
                <TableCell class={c.id === 'title' ? 'max-w-xs truncate font-medium' : 'text-nowrap'}>
                  {#if c.id === 'title'}
                    {#if post.isFeatured}<StarIcon class="mr-1 -mt-0.5 inline-block size-4 fill-yellow-500 text-yellow-500" />{/if}
                    <a href={`/admin/posts/${post.id}`} class="hover:underline">{post.title}</a>
                  {:else if c.id === 'status'}
                    <Badge variant="outline" class={statusColors[post.status] ?? ''}>{#if post.status === 'scheduled'}<ClockIcon class="me-1 size-3" />{/if}{statusLabel(post.status)}</Badge>
                  {:else if c.id === 'viewCount'}
                    <span class="text-sm text-muted-foreground">{post.viewCount}</span>
                  {:else}
                    <span class="text-sm text-muted-foreground">{formatDate(postDate(post))}</span>
                  {/if}
                </TableCell>
              {/each}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    {#snippet child({ props })}
                      <Button {...props} variant="ghost" class="flex size-8 p-0 data-[state=open]:bg-muted"><EllipsisIcon class="size-4" /><span class="sr-only">Open menu</span></Button>
                    {/snippet}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-44">
                    <DropdownMenuItem onclick={() => goto(`/admin/posts/${post.id}`)}><PencilIcon /> Edit</DropdownMenuItem>
                    {#if post.status !== 'publish'}
                      <DropdownMenuItem onclick={() => setStatus(post, 'publish')}><SendIcon /> {post.status === 'scheduled' ? 'Publish now' : 'Publish'}</DropdownMenuItem>
                    {/if}
                    {#if post.status !== 'draft'}
                      <DropdownMenuItem onclick={() => setStatus(post, 'draft')}><FileTextIcon /> Back to Draft</DropdownMenuItem>
                    {/if}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onclick={() => (deleting = [post])}><Trash2Icon /> Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          {/each}
        {/if}
      </TableBody>
    </Table>
  </div>

  <DataTablePagination {table} class="mt-auto" />
</div>

<DataTableBulkActions {table} entityName="post">
  {#snippet actions()}
    <Button size="sm" variant="outline" disabled={busy} onclick={() => bulkStatus('publish')}><SendIcon class="size-4" /> Publish</Button>
    <Button size="sm" variant="outline" disabled={busy} onclick={() => bulkStatus('draft')}><FileTextIcon class="size-4" /> Draft</Button>
    <Button size="sm" variant="destructive" disabled={busy} onclick={() => (deleting = table.selectedRows)}><Trash2Icon class="size-4" /> Delete</Button>
  {/snippet}
</DataTableBulkActions>

<AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) deleting = null }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete {deleting?.length === 1 ? 'this post' : `${deleting?.length} posts`}?</AlertDialogTitle>
      <AlertDialogDescription>
        {#if deleting?.length === 1}"{deleting[0].title}" and its comments will be permanently deleted.{:else}The selected posts and their comments will be permanently deleted.{/if}
        This cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onclick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
