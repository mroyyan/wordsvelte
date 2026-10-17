<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import FilePlusIcon from '@lucide/svelte/icons/file-plus'
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import SendIcon from '@lucide/svelte/icons/send'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
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
  import { api, errorMessage, runBulk } from '$lib/client/admin-api'
  import { formatDate } from '$lib/utils'

  interface PageRow { id: number; title: string; slug: string; status: 'draft' | 'publish'; updatedAt: string; publishedAt: string | null }

  const statusOptions = [{ label: 'Published', value: 'publish' }, { label: 'Draft', value: 'draft' }]
  const statusColors: Record<string, string> = {
    publish: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-900',
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-900',
  }
  const columns = [
    { id: 'title', title: 'Title' },
    { id: 'slug', title: 'Address', secondary: true },
    { id: 'status', title: 'Status', secondary: true },
    { id: 'updatedAt', title: 'Updated', secondary: true },
  ]

  const table = new DataTableState<PageRow>({
    getId: p => p.id,
    searchFields: [p => p.title, p => p.slug],
    filterAccessors: { status: p => p.status },
    sortAccessors: { title: p => p.title, slug: p => p.slug, status: p => p.status, updatedAt: p => p.updatedAt },
  })

  let loading = $state(true)
  let error = $state('')
  let busy = $state(false)
  let deleting = $state<PageRow[] | null>(null)
  const visibleColumns = $derived(columns.filter(c => table.isVisible(c.id)))

  async function load() {
    loading = true; error = ''
    try { table.setRows(await api<PageRow[]>('/api/pages')) }
    catch (e) { error = errorMessage(e) } finally { loading = false }
  }
  onMount(load)

  async function setStatus(rows: PageRow[], status: PageRow['status']) {
    busy = true
    const { ok, failed, firstError } = await runBulk(rows, r => api(`/api/pages/${r.id}`, { method: 'PATCH', body: { status } }))
    await load(); table.clearSelection(); busy = false
    if (failed) toast.error(`${ok} updated, ${failed} failed: ${firstError}`)
    else toast.success(`${ok} page${ok === 1 ? '' : 's'} ${status === 'publish' ? 'published' : 'moved to draft'}`)
  }

  async function confirmDelete() {
    const targets = deleting
    if (!targets) return
    deleting = null; busy = true
    const { ok, failed, firstError } = await runBulk(targets, r => api(`/api/pages/${r.id}`, { method: 'DELETE' }))
    await load(); table.clearSelection(); busy = false
    if (failed) toast.error(`${ok} deleted, ${failed} failed: ${firstError}`)
    else toast.success(`${ok} page${ok === 1 ? '' : 's'} deleted`)
  }
</script>

<svelte:head><title>Pages</title></svelte:head>

<div class="flex flex-1 flex-col gap-4">
  <PageHeader title="Pages" description="Static pages such as About, Contact or Editorial Guidelines. Add them to a menu under Appearance.">
    {#snippet actions()}
      <PrimaryButton label="Add Page" icon={FilePlusIcon} onclick={() => (window.location.href = '/admin/pages/new')} />
    {/snippet}
  </PageHeader>

  <DataTableToolbar {table} searchPlaceholder="Filter pages..." {columns}>
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
            <TableHead class={c.secondary ? 'hidden sm:table-cell' : ''}><DataTableColumnHeader {table} column={c.id} title={c.title} /></TableHead>
          {/each}
          <TableHead class="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if loading}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center"><Loader2Icon class="mx-auto size-4 animate-spin text-muted-foreground" /></TableCell></TableRow>
        {:else if table.pageRows.length === 0}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center text-muted-foreground">{table.isFiltered ? 'No pages match your filters.' : 'No pages yet. Create your first one.'}</TableCell></TableRow>
        {:else}
          {#each table.pageRows as row (row.id)}
            <TableRow data-state={table.isSelected(row) ? 'selected' : undefined}>
              <TableCell><Checkbox checked={table.isSelected(row)} onCheckedChange={() => table.toggleRow(row)} aria-label="Select row" class="translate-y-0.5" /></TableCell>
              {#each visibleColumns as c (c.id)}
                <TableCell class={[c.id === 'title' ? 'max-w-[15rem] font-medium sm:max-w-80' : 'text-nowrap', c.secondary && 'hidden sm:table-cell']}>
                  {#if c.id === 'title'}
                    <a href={`/admin/pages/${row.id}`} class="block truncate hover:underline">{row.title}</a>
                    <div class="mt-1 flex items-center gap-2 text-xs font-normal text-muted-foreground sm:hidden">
                      <Badge variant="outline" class={statusColors[row.status]}>{row.status === 'publish' ? 'Published' : 'Draft'}</Badge>
                      <span class="font-mono">/{row.slug}</span>
                    </div>
                  {:else if c.id === 'slug'}
                    <span class="font-mono text-xs text-muted-foreground">/{row.slug}</span>
                  {:else if c.id === 'status'}
                    <Badge variant="outline" class={statusColors[row.status]}>{row.status === 'publish' ? 'Published' : 'Draft'}</Badge>
                  {:else}
                    {formatDate(row.updatedAt)}
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
                    <DropdownMenuItem onclick={() => (window.location.href = `/admin/pages/${row.id}`)}><PencilIcon /> Edit</DropdownMenuItem>
                    {#if row.status === 'publish'}
                      <DropdownMenuItem onclick={() => window.open(`/${row.slug}`, '_blank')}><ExternalLinkIcon /> View</DropdownMenuItem>
                      <DropdownMenuItem onclick={() => setStatus([row], 'draft')}><FileTextIcon /> Back to Draft</DropdownMenuItem>
                    {:else}
                      <DropdownMenuItem onclick={() => setStatus([row], 'publish')}><SendIcon /> Publish</DropdownMenuItem>
                    {/if}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onclick={() => (deleting = [row])}><Trash2Icon /> Delete</DropdownMenuItem>
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

<DataTableBulkActions {table} entityName="page">
  {#snippet actions()}
    <Button size="sm" variant="outline" disabled={busy} onclick={() => setStatus(table.selectedRows, 'publish')}><SendIcon class="size-4" /> Publish</Button>
    <Button size="sm" variant="outline" disabled={busy} onclick={() => setStatus(table.selectedRows, 'draft')}><FileTextIcon class="size-4" /> Draft</Button>
    <Button size="sm" variant="destructive" disabled={busy} onclick={() => (deleting = table.selectedRows)}><Trash2Icon class="size-4" /> Delete</Button>
  {/snippet}
</DataTableBulkActions>

<AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) deleting = null }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete {deleting?.length === 1 ? 'this page' : `${deleting?.length} pages`}?</AlertDialogTitle>
      <AlertDialogDescription>
        {#if deleting?.length === 1}"{deleting[0].title}" will be removed.{:else}The selected pages will be removed.{/if}
        Menu items pointing to {deleting?.length === 1 ? 'it' : 'them'} will stop showing. This cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onclick={confirmDelete}>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
