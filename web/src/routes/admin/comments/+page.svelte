<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import BanIcon from '@lucide/svelte/icons/ban'
  import EyeIcon from '@lucide/svelte/icons/eye'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table'
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '$lib/components/ui/dialog'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu'
  import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  } from '$lib/components/ui/alert-dialog'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import {
    DataTableState, DataTableToolbar, DataTableFacetedFilter, DataTableColumnHeader, DataTablePagination, DataTableBulkActions,
  } from '$lib/components/data-table'
  import { api, errorMessage, fetchAll, runBulk } from '$lib/admin-api'
  import { formatDate } from '$lib/utils'

  interface CommentRow { id: number; postId: number; authorName: string; authorEmail: string; content: string; status: 'approved' | 'pending' | 'spam' | 'trash'; createdAt: string }

  const statusOptions = [
    { label: 'Approved', value: 'approved' },
    { label: 'Pending', value: 'pending' },
    { label: 'Spam', value: 'spam' },
    { label: 'Trash', value: 'trash' },
  ]
  const statusColors: Record<string, string> = {
    approved: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900',
    spam: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
    trash: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  }
  const columns = [
    { id: 'authorName', title: 'Author' },
    { id: 'content', title: 'Comment' },
    { id: 'status', title: 'Status' },
    { id: 'createdAt', title: 'Date' },
  ]

  const table = new DataTableState<CommentRow>({
    getId: c => c.id,
    searchFields: [c => c.authorName, c => c.authorEmail, c => c.content],
    filterAccessors: { status: c => c.status },
    sortAccessors: { authorName: c => c.authorName, status: c => c.status, createdAt: c => Date.parse(c.createdAt) || 0 },
  })

  let loading = $state(true)
  let error = $state('')
  let busy = $state(false)
  let viewing = $state<CommentRow | null>(null)
  let deleting = $state<CommentRow[] | null>(null)
  const visibleColumns = $derived(columns.filter(c => table.isVisible(c.id)))

  async function load() {
    loading = true; error = ''
    try { table.setRows(await fetchAll<CommentRow>('/api/comments/admin')) }
    catch (e) { error = errorMessage(e) } finally { loading = false }
  }
  onMount(load)

  async function moderate(row: CommentRow, status: CommentRow['status']) {
    try {
      await api(`/api/comments/${row.id}/status`, { method: 'PATCH', body: { status } })
      table.setRows(table.rows.map(r => (r.id === row.id ? { ...r, status } : r)))
      toast.success(`Marked as ${status}`)
    } catch (e) { toast.error(errorMessage(e)) }
  }

  async function bulkModerate(status: CommentRow['status']) {
    busy = true
    const { ok, failed, firstError } = await runBulk(table.selectedRows, r => api(`/api/comments/${r.id}/status`, { method: 'PATCH', body: { status } }))
    await load(); table.clearSelection(); busy = false
    if (failed) toast.error(`${ok} updated, ${failed} failed: ${firstError}`)
    else toast.success(`${ok} comment${ok === 1 ? '' : 's'} marked as ${status}`)
  }

  async function confirmDelete() {
    const targets = deleting
    if (!targets) return
    deleting = null; busy = true
    const { ok, failed, firstError } = await runBulk(targets, r => api(`/api/comments/${r.id}`, { method: 'DELETE' }))
    await load(); table.clearSelection(); busy = false
    if (failed) toast.error(`${ok} deleted, ${failed} failed: ${firstError}`)
    else toast.success(`${ok} comment${ok === 1 ? '' : 's'} deleted`)
  }
</script>

<svelte:head><title>Comments</title></svelte:head>

<div class="flex flex-1 flex-col gap-4">
  <PageHeader title="Comments" description="Moderate reader comments" />

  <DataTableToolbar {table} searchPlaceholder="Search comments..." {columns}>
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
            <TableHead><DataTableColumnHeader {table} column={c.id} title={c.title} sortable={c.id !== 'content'} /></TableHead>
          {/each}
          <TableHead class="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if loading}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center"><Loader2Icon class="mx-auto size-4 animate-spin text-muted-foreground" /></TableCell></TableRow>
        {:else if table.pageRows.length === 0}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center text-muted-foreground">{table.isFiltered ? 'No comments match your filters.' : 'No comments yet.'}</TableCell></TableRow>
        {:else}
          {#each table.pageRows as c (c.id)}
            <TableRow data-state={table.isSelected(c) ? 'selected' : undefined}>
              <TableCell><Checkbox checked={table.isSelected(c)} onCheckedChange={() => table.toggleRow(c)} aria-label="Select row" class="translate-y-0.5" /></TableCell>
              {#each visibleColumns as col (col.id)}
                <TableCell class={col.id === 'content' ? 'max-w-xs truncate text-sm' : 'text-nowrap'}>
                  {#if col.id === 'authorName'}
                    <div class="font-medium">{c.authorName}</div>
                    <div class="text-xs text-muted-foreground">{c.authorEmail}</div>
                  {:else if col.id === 'content'}
                    {c.content}
                  {:else if col.id === 'status'}
                    <Badge variant="outline" class={statusColors[c.status] ?? ''}>{statusOptions.find(o => o.value === c.status)?.label ?? c.status}</Badge>
                  {:else}
                    <span class="text-sm text-muted-foreground">{formatDate(c.createdAt)}</span>
                  {/if}
                </TableCell>
              {/each}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    {#snippet child({ props })}
                      <Button {...props} variant="ghost" class="flex size-8 p-0 data-[state=open]:bg-muted"><EllipsisIcon class="size-4" /><span class="sr-only">Actions</span></Button>
                    {/snippet}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-44">
                    {#if c.status !== 'approved'}<DropdownMenuItem onclick={() => moderate(c, 'approved')}><ShieldCheckIcon class="text-green-500" /> Approve</DropdownMenuItem>{/if}
                    {#if c.status !== 'spam'}<DropdownMenuItem onclick={() => moderate(c, 'spam')}><BanIcon class="text-orange-500" /> Mark Spam</DropdownMenuItem>{/if}
                    <DropdownMenuItem onclick={() => (viewing = c)}><EyeIcon /> View</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onclick={() => (deleting = [c])}><Trash2Icon /> Delete</DropdownMenuItem>
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

<DataTableBulkActions {table} entityName="comment">
  {#snippet actions()}
    <Button size="sm" variant="outline" disabled={busy} onclick={() => bulkModerate('approved')}><ShieldCheckIcon class="size-4" /> Approve</Button>
    <Button size="sm" variant="outline" disabled={busy} onclick={() => bulkModerate('spam')}><BanIcon class="size-4" /> Spam</Button>
    <Button size="sm" variant="destructive" disabled={busy} onclick={() => (deleting = table.selectedRows)}><Trash2Icon class="size-4" /> Delete</Button>
  {/snippet}
</DataTableBulkActions>

<Dialog open={viewing !== null} onOpenChange={(o) => { if (!o) viewing = null }}>
  <DialogContent class="sm:max-w-lg">
    {#if viewing}
      <DialogHeader>
        <DialogTitle>{viewing.authorName}</DialogTitle>
        <DialogDescription>{viewing.authorEmail} &middot; {formatDate(viewing.createdAt)}</DialogDescription>
      </DialogHeader>
      <!-- Plain text on purpose: comment bodies are untrusted and never rendered as HTML. -->
      <p class="whitespace-pre-wrap break-words text-sm">{viewing.content}</p>
      <Badge variant="outline" class="w-fit {statusColors[viewing.status] ?? ''}">{viewing.status}</Badge>
    {/if}
  </DialogContent>
</Dialog>

<AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) deleting = null }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete {deleting?.length === 1 ? 'this comment' : `${deleting?.length} comments`}?</AlertDialogTitle>
      <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onclick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
