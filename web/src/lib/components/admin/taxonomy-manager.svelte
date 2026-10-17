<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import PlusIcon from '@lucide/svelte/icons/plus'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import Trash2Icon from '@lucide/svelte/icons/trash-2'
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table'
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu'
  import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  } from '$lib/components/ui/alert-dialog'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import PrimaryButton from '$lib/components/layout/primary-button.svelte'
  import { DataTableState, DataTableToolbar, DataTableColumnHeader, DataTablePagination, DataTableBulkActions } from '$lib/components/data-table'
  import { api, errorMessage, runBulk } from '$lib/client/admin-api'
  import { tr, msg } from '$lib/i18n/admin'

  interface Row { id: number; name: string; slug: string; description?: string | null }

  /** One admin screen for both categories and tags: they only differ in endpoint, wording and the description field. */
  let { kind, withDescription = false }: { kind: 'category' | 'tag'; withDescription?: boolean } = $props()

  const endpoint = $derived(kind === 'category' ? '/api/categories' : '/api/tags')
  // the wording of each kind, written out in full so every text translates as a whole sentence
  const words = {
    category: {
      noun: msg('category'), plural: msg('Categories'), subtitle: msg('Organize content'), add: msg('Add Category'), filter: msg('Filter categories...'),
      noMatch: msg('No categories match your filter.'), none: msg('No categories yet.'), updated: msg('Category updated'), created: msg('Category created'),
      oneDeleted: msg('1 category deleted'), manyDeleted: msg('{n} categories deleted'), editTitle: msg('Edit Category'), newTitle: msg('New Category'),
      deleteOne: msg('Delete this category?'), deleteMany: msg('Delete {n} categories?'),
      noteOne: msg('Posts keep existing, but they will no longer be filed under it. This cannot be undone.'),
      noteMany: msg('Posts keep existing, but they will no longer be filed under them. This cannot be undone.'),
    },
    tag: {
      noun: msg('tag'), plural: msg('Tags'), subtitle: msg('Label and group related posts'), add: msg('Add Tag'), filter: msg('Filter tags...'),
      noMatch: msg('No tags match your filter.'), none: msg('No tags yet.'), updated: msg('Tag updated'), created: msg('Tag created'),
      oneDeleted: msg('1 tag deleted'), manyDeleted: msg('{n} tags deleted'), editTitle: msg('Edit Tag'), newTitle: msg('New Tag'),
      deleteOne: msg('Delete this tag?'), deleteMany: msg('Delete {n} tags?'),
      noteOne: msg('Posts keep existing, but they will no longer be filed under it. This cannot be undone.'),
      noteMany: msg('Posts keep existing, but they will no longer be filed under them. This cannot be undone.'),
    },
  }
  const w = $derived(words[kind])
  const columns = $derived([
    { id: 'name', title: msg('Name') },
    { id: 'slug', title: msg('Slug') },
    ...(withDescription ? [{ id: 'description', title: msg('Description') }] : []),
  ])

  const table = new DataTableState<Row>({
    getId: r => r.id,
    searchFields: [r => r.name, r => r.slug],
    sortAccessors: { name: r => r.name, slug: r => r.slug, description: r => r.description },
  })

  let loading = $state(true)
  let error = $state('')
  let saving = $state(false)
  let dialogOpen = $state(false)
  let editing = $state<Row | null>(null)
  let name = $state('')
  let description = $state('')
  let formError = $state('')
  let deleting = $state<Row[] | null>(null)
  const visibleColumns = $derived(columns.filter(c => table.isVisible(c.id)))

  async function load() {
    loading = true; error = ''
    try { table.setRows(await api<Row[]>(endpoint)) } catch (e) { error = errorMessage(e) } finally { loading = false }
  }
  onMount(load)

  function openCreate() { editing = null; name = ''; description = ''; formError = ''; dialogOpen = true }
  function openEdit(row: Row) { editing = row; name = row.name; description = row.description ?? ''; formError = ''; dialogOpen = true }

  async function save(e: Event) {
    e.preventDefault()
    if (!name.trim()) return
    saving = true; formError = ''
    try {
      const body = withDescription ? { name, description: description || null } : { name }
      if (editing) {
        const updated = await api<Row>(`${endpoint}/${editing.id}`, { method: 'PUT', body })
        table.setRows(table.rows.map(r => (r.id === editing!.id ? updated : r)))
        toast.success(tr(w.updated))
      } else {
        const created = await api<Row>(endpoint, { method: 'POST', body })
        table.setRows([...table.rows, created])
        toast.success(tr(w.created))
      }
      dialogOpen = false
    } catch (err) { formError = errorMessage(err) } finally { saving = false }
  }

  async function confirmDelete() {
    const targets = deleting
    if (!targets) return
    deleting = null
    const { ok, failed, firstError } = await runBulk(targets, r => api(`${endpoint}/${r.id}`, { method: 'DELETE' }))
    await load(); table.clearSelection()
    if (failed) toast.error(tr('{ok} deleted, {failed} failed: {error}', { ok, failed, error: firstError ?? '' }))
    else toast.success(ok === 1 ? tr(w.oneDeleted) : tr(w.manyDeleted, { n: ok }))
  }
</script>

<svelte:head><title>{tr(w.plural)}</title></svelte:head>

<div class="flex flex-1 flex-col gap-4">
  <PageHeader title={tr(w.plural)} description={tr(w.subtitle)}>
    {#snippet actions()}
      <PrimaryButton label={tr(w.add)} icon={PlusIcon} onclick={openCreate} />
    {/snippet}
  </PageHeader>

  <DataTableToolbar {table} searchPlaceholder={w.filter} {columns} />

  {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}

  <div class="overflow-hidden rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-10"><Checkbox checked={table.allOnPageSelected} indeterminate={table.someOnPageSelected} onCheckedChange={() => table.toggleAllOnPage()} aria-label={tr('Select all')} class="translate-y-0.5" /></TableHead>
          {#each visibleColumns as c (c.id)}
            <TableHead><DataTableColumnHeader {table} column={c.id} title={c.title} sortable={c.id !== 'description'} /></TableHead>
          {/each}
          <TableHead class="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if loading}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center"><Loader2Icon class="mx-auto size-4 animate-spin text-muted-foreground" /></TableCell></TableRow>
        {:else if table.pageRows.length === 0}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center text-muted-foreground">{table.isFiltered ? tr(w.noMatch) : tr(w.none)}</TableCell></TableRow>
        {:else}
          {#each table.pageRows as row (row.id)}
            <TableRow data-state={table.isSelected(row) ? 'selected' : undefined}>
              <TableCell><Checkbox checked={table.isSelected(row)} onCheckedChange={() => table.toggleRow(row)} aria-label={tr('Select row')} class="translate-y-0.5" /></TableCell>
              {#each visibleColumns as c (c.id)}
                <TableCell class={c.id === 'name' ? 'max-w-xs truncate font-medium' : c.id === 'slug' ? 'font-mono text-xs text-muted-foreground' : 'max-w-sm truncate text-sm text-muted-foreground'}>
                  {#if c.id === 'name'}{row.name}{:else if c.id === 'slug'}{row.slug}{:else}{row.description ?? ''}{/if}
                </TableCell>
              {/each}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    {#snippet child({ props })}
                      <Button {...props} variant="ghost" class="flex size-8 p-0 data-[state=open]:bg-muted"><EllipsisIcon class="size-4" /><span class="sr-only">{tr('Open menu')}</span></Button>
                    {/snippet}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-40">
                    <DropdownMenuItem onclick={() => openEdit(row)}><PencilIcon /> {tr('Edit')}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onclick={() => (deleting = [row])}><Trash2Icon /> {tr('Delete')}</DropdownMenuItem>
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

<DataTableBulkActions {table} entityName={w.noun}>
  {#snippet actions()}
    <Button size="sm" variant="destructive" onclick={() => (deleting = table.selectedRows)}><Trash2Icon class="size-4" /> {tr('Delete')}</Button>
  {/snippet}
</DataTableBulkActions>

<Dialog open={dialogOpen} onOpenChange={(o) => (dialogOpen = o)}>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{editing ? tr(w.editTitle) : tr(w.newTitle)}</DialogTitle>
      <DialogDescription>{editing ? tr('Changing the name keeps the address ({slug}).', { slug: editing.slug }) : tr('The address is generated from the name.')}</DialogDescription>
    </DialogHeader>
    <form onsubmit={save} class="grid gap-4">
      <div class="grid gap-2"><Label for="tx-name">{tr('Name')}</Label><Input id="tx-name" bind:value={name} required /></div>
      {#if withDescription}
        <div class="grid gap-2"><Label for="tx-desc">{tr('Description')}</Label><Textarea id="tx-desc" bind:value={description} rows={3} /></div>
      {/if}
      {#if formError}<Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>{/if}
      <DialogFooter>
        <Button type="button" variant="outline" onclick={() => (dialogOpen = false)}>{tr('Cancel')}</Button>
        <Button type="submit" disabled={saving}>{#if saving}<Loader2Icon class="animate-spin" />{/if} {tr('Save')}</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>

<AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) deleting = null }}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>{deleting?.length === 1 ? tr(w.deleteOne) : tr(w.deleteMany, { n: deleting?.length ?? 0 })}</AlertDialogTitle>
      <AlertDialogDescription>{deleting?.length === 1 ? tr(w.noteOne) : tr(w.noteMany)}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>{tr('Cancel')}</AlertDialogCancel>
      <AlertDialogAction onclick={confirmDelete}>{tr('Delete')}</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
