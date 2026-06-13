<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table'
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '$lib/components/ui/dialog'
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '$lib/components/ui/alert-dialog'
  import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
  } from '$lib/components/ui/dropdown-menu'
  import { Plus, Pencil, Trash2, Ellipsis } from '@lucide/svelte'
  import ChevronLeft from '@lucide/svelte/icons/chevron-left'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import ChevronsLeft from '@lucide/svelte/icons/chevrons-left'
  import ChevronsRight from '@lucide/svelte/icons/chevrons-right'

  let mounted = $state(false)
  onMount(() => { mounted = true })

  let items = $state<any[]>([])
  let loading = $state(true)
  let search = $state('')
  let page = $state(1)
  let pageSize = $state(10)
  let rowSelection = $state<Set<number>>(new Set())
  let dialogOpen = $state(false)
  let editItem = $state<any | null>(null)
  let deleteId = $state<number | null>(null)
  let name = $state('')

  function t() { return localStorage.getItem('wordsvelte_token') }

  onMount(async () => { const tok = t(); if (!tok) return; try { const r = await fetch('/api/tags', { headers: { Authorization: `Bearer ${tok}` } }); const j = await r.json(); items = j.data ?? [] } catch {} finally { loading = false } })

  let filtered = $derived(search ? items.filter((i: any) => i.name?.toLowerCase().includes(search.toLowerCase())) : items)
  let totalPages = $derived(Math.ceil(filtered.length / pageSize) || 1)
  let paged = $derived(filtered.slice((page - 1) * pageSize, page * pageSize))
  let allSelected = $derived(paged.length > 0 && paged.every(r => rowSelection.has(r.id)))
  let someSelected = $derived(paged.some(r => rowSelection.has(r.id)) && !allSelected)

  function toggleAll() { if (allSelected) { paged.forEach(r => rowSelection.delete(r.id)); rowSelection = new Set(rowSelection) } else { paged.forEach(r => rowSelection.add(r.id)); rowSelection = new Set(rowSelection) } }
  function toggle(id: number) { if (rowSelection.has(id)) { rowSelection.delete(id) } else { rowSelection.add(id) }; rowSelection = new Set(rowSelection) }

  function openCreate() { editItem = null; name = ''; dialogOpen = true }
  function openEdit(tag: any) { editItem = tag; name = tag.name; dialogOpen = true }

  async function handleSave() {
    if (!name.trim()) return; const tok = t(); if (!tok) return
    try {
      if (editItem) { const r = await fetch(`/api/tags/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ name }) }); const j = await r.json(); if (j.data) items = items.map((c: any) => c.id === editItem.id ? j.data : c) }
      else { const r = await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ name }) }); const j = await r.json(); if (j.data) items = [...items, j.data] }
      dialogOpen = false
    } catch (e: any) { alert(e.message) }
  }

  async function handleDelete() { if (!deleteId) return; const tok = t(); if (!tok) return; try { await fetch(`/api/tags/${deleteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }); items = items.filter((c: any) => c.id !== deleteId) } catch (e: any) { alert(e.message) } finally { deleteId = null } }

  function getPageNumbers(): (number | '...')[] {
    const total = totalPages; const current = page
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
    return [1, '...', current - 1, current, current + 1, '...', total]
  }
</script>

{#if mounted}
<div class="flex flex-1 flex-col gap-4">
  <div class="flex flex-wrap items-end justify-between gap-2">
    <div><h2 class="text-2xl font-bold tracking-tight">Tags</h2><p class="text-muted-foreground">Manage tags</p></div>
    <Button onclick={openCreate}><Plus class="mr-2 h-4 w-4" /> New Tag</Button>
  </div>

  <div class="flex items-center justify-between">
    <div class="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
      <Input placeholder="Filter tags..." bind:value={search} class="h-8 w-[150px] lg:w-[250px]" oninput={() => page = 1} />
    </div>
  </div>

  <div class="overflow-hidden rounded-md border">
    <Table>
      <TableHeader>
        <TableRow class="group/row">
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted w-10"><Checkbox checked={allSelected} indeterminate={someSelected} onCheckedChange={toggleAll} aria-label="Select all" class="translate-y-0.5" /></TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted"><span class="text-xs font-medium text-muted-foreground">Name</span></TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted"><span class="text-xs font-medium text-muted-foreground">Slug</span></TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if loading}
          <TableRow><TableCell colspan={4} class="h-24 text-center text-muted-foreground">Loading...</TableCell></TableRow>
        {:else if paged.length === 0}
          <TableRow><TableCell colspan={4} class="h-24 text-center text-muted-foreground">No tags.</TableCell></TableRow>
        {:else}
          {#each paged as tag (tag.id)}
            <TableRow data-state={rowSelection.has(tag.id) && 'selected'} class="group/row">
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted"><Checkbox checked={rowSelection.has(tag.id)} onCheckedChange={() => toggle(tag.id)} aria-label="Select row" class="translate-y-0.5" /></TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted font-medium">{tag.name}</TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted text-sm text-muted-foreground">/{tag.slug}</TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="ghost" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                      <Ellipsis class="h-4 w-4" />
                      <span class="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-40">
                    <DropdownMenuItem onclick={() => openEdit(tag)}>
                      Edit
                      <span class="ml-auto"><Pencil size={16} /></span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem class="text-red-500 focus:text-red-500!" onclick={() => deleteId = tag.id}>
                      Delete
                      <span class="ml-auto"><Trash2 size={16} /></span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          {/each}
        {/if}
      </TableBody>
    </Table>
  </div>

  <div class="flex items-center justify-between overflow-clip px-2 @max-2xl/content:flex-col-reverse @max-2xl/content:gap-4 mt-auto" style="overflow-clip-margin: 1px">
    <div class="flex w-full items-center justify-between">
      <div class="flex w-25 items-center justify-center text-sm font-medium @2xl/content:hidden">Page {page} of {totalPages}</div>
      <div class="flex items-center gap-2 @max-2xl/content:flex-row-reverse">
        <select class="h-8 w-17.5 rounded-md border border-input bg-transparent px-2 text-sm" bind:value={pageSize} onchange={() => page = 1}>{#each [10, 20, 30, 40, 50] as size}<option value={size}>{size}</option>{/each}</select>
        <p class="hidden text-sm font-medium sm:block">Rows per page</p>
      </div>
    </div>
    <div class="flex items-center sm:space-x-6 lg:space-x-8">
      {#if totalPages > 1}<div class="flex w-25 items-center justify-center text-sm font-medium @max-3xl/content:hidden">Page {page} of {totalPages}</div>{/if}
      <div class="flex items-center space-x-2">
        <Button variant="outline" class="size-8 p-0 @max-md/content:hidden" disabled={page <= 1} onclick={() => page = 1}><ChevronsLeft class="h-4 w-4" /><span class="sr-only">First</span></Button>
        <Button variant="outline" class="size-8 p-0" disabled={page <= 1} onclick={() => page = Math.max(1, page - 1)}><ChevronLeft class="h-4 w-4" /><span class="sr-only">Previous</span></Button>
        {#each getPageNumbers() as pn}
          {#if pn === '...'}<span class="px-1 text-sm text-muted-foreground">...</span>{:else}<Button variant={page === pn ? 'default' : 'outline'} class="h-8 min-w-8 px-2" onclick={() => page = pn as number}>{pn}</Button>{/if}
        {/each}
        <Button variant="outline" class="size-8 p-0" disabled={page >= totalPages} onclick={() => page = Math.min(totalPages, page + 1)}><ChevronRight class="h-4 w-4" /><span class="sr-only">Next</span></Button>
        <Button variant="outline" class="size-8 p-0 @max-md/content:hidden" disabled={page >= totalPages} onclick={() => page = totalPages}><ChevronsRight class="h-4 w-4" /><span class="sr-only">Last</span></Button>
      </div>
    </div>
  </div>
</div>

<Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) dialogOpen = false }}>
  <DialogContent class="sm:max-w-sm"><DialogHeader><DialogTitle>{editItem ? 'Edit' : 'New'} Tag</DialogTitle></DialogHeader><div class="py-4"><Input bind:value={name} placeholder="Tag name" /></div><DialogFooter><Button variant="outline" onclick={() => dialogOpen = false}>Cancel</Button><Button onclick={handleSave}>Save</Button></DialogFooter></DialogContent>
</Dialog>

<AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) deleteId = null }}>
  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete tag?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onclick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
</AlertDialog>
{:else}
  <div class="flex flex-1 flex-col gap-4"><div class="flex items-center justify-center h-24 text-muted-foreground">Loading...</div></div>
{/if}

