<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table'
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '$lib/components/ui/command'
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '$lib/components/ui/alert-dialog'
  import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
  } from '$lib/components/ui/dropdown-menu'
  import { Plus, Pencil, Trash2, Check, CirclePlus, X as XIcon, Ellipsis, FileText, Send } from 'lucide-svelte'
  import ChevronLeft from '@lucide/svelte/icons/chevron-left'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import ChevronsLeft from '@lucide/svelte/icons/chevrons-left'
  import ChevronsRight from '@lucide/svelte/icons/chevrons-right'

  let mounted = $state(false)
  onMount(() => { mounted = true })

  let items = $state<any[]>([])
  let loading = $state(true)
  let search = $state('')
  let statusFilter = $state<string[]>([])
  let page = $state(1); let pageSize = $state(10)
  let deleteId = $state<number | null>(null)
  let rowSelection = $state<Set<number>>(new Set())

  function t() { return localStorage.getItem('kubus_token') }

  onMount(async () => {
    const tok = t(); if (!tok) return;
    try {
      const r = await fetch('/api/posts-admin', { headers: { Authorization: `Bearer ${tok}` } })
      const j = await r.json(); items = j.data ?? []
    } catch {} finally { loading = false }
  })

  const statusOptions = [{ label: 'Publish', value: 'publish' }, { label: 'Draft', value: 'draft' }, { label: 'Trash', value: 'trash' }]
  const statusColors: Record<string, string> = { publish: 'bg-green-100 text-green-800 border-green-200', draft: 'bg-yellow-100 text-yellow-800 border-yellow-200', trash: 'bg-red-100 text-red-800 border-red-200' }

  let filtered = $derived.by(() => {
    let r = items
    if (search) r = r.filter((i: any) => i.title?.toLowerCase().includes(search.toLowerCase()))
    if (statusFilter.length) r = r.filter((i: any) => statusFilter.includes(i.status))
    return r
  })
  let totalPages = $derived(Math.ceil(filtered.length / pageSize) || 1)
  let paged = $derived(filtered.slice((page - 1) * pageSize, page * pageSize))
  let isFiltered = $derived(search || statusFilter.length)
  let allSelected = $derived(paged.length > 0 && paged.every(r => rowSelection.has(r.id)))
  let someSelected = $derived(paged.some(r => rowSelection.has(r.id)) && !allSelected)

  function toggleAll() { if (allSelected) { paged.forEach(r => rowSelection.delete(r.id)); rowSelection = new Set(rowSelection) } else { paged.forEach(r => rowSelection.add(r.id)); rowSelection = new Set(rowSelection) } }
  function toggle(id: number) { if (rowSelection.has(id)) { rowSelection.delete(id) } else { rowSelection.add(id) }; rowSelection = new Set(rowSelection) }

  function resetFilters() { search = ''; statusFilter = []; page = 1 }

  async function updateStatus(id: number, status: string) {
    const tok = t()
    if (!tok) return
    try {
      const res = await fetch(`/api/posts-admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ status })
      })
      const json = await res.json()
      if (json.success) {
        items = items.map(i => i.id === id ? { ...i, status } : i)
      } else {
        throw new Error(json.error)
      }
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function handleDelete() { if (!deleteId) return; const tok = t(); if (!tok) return; try { await fetch(`/api/posts/${deleteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }); items = items.filter((c: any) => c.id !== deleteId) } catch (e: any) { alert(e.message) } finally { deleteId = null } }

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
    <div><h2 class="text-2xl font-bold tracking-tight">Posts</h2><p class="text-muted-foreground">Manage articles</p></div>
    <Button onclick={() => goto('/admin/posts/new')}><Plus class="mr-2 h-4 w-4" /> New Post</Button>
  </div>

  <div class="flex items-center justify-between">
    <div class="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
      <Input placeholder="Filter by title..." bind:value={search} class="h-8 w-[150px] lg:w-[250px]" oninput={() => page = 1} />
      <div class="flex gap-x-2">
        <Popover>
          <PopoverTrigger><Button variant="outline" class="h-8 border-dashed"><CirclePlus class="mr-2 h-4 w-4" /> Status{#if statusFilter.length}<div class="ml-1 rounded bg-secondary px-1 text-xs font-medium">{statusFilter.length}</div>{/if}</Button></PopoverTrigger>
          <PopoverContent class="w-48 p-0" align="start">
            <Command class="p-0 [&_[cmdk-input-wrapper]]:p-0 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:p-[1px] [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-9 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-1.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
              <CommandInput placeholder="Filter status..." />
              <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup>
                  {#each statusOptions as opt}
                    <CommandItem onselect={() => { statusFilter = statusFilter.includes(opt.value) ? statusFilter.filter((r: string) => r !== opt.value) : [...statusFilter, opt.value]; page = 1 }}>
                      <div class="mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary">{#if statusFilter.includes(opt.value)}<Check class="h-3 w-3" />{/if}</div>
                      <span>{opt.label}</span>
                    </CommandItem>
                  {/each}
                </CommandGroup>
                {#if isFiltered}<CommandSeparator /><CommandGroup><CommandItem onselect={resetFilters} class="justify-center text-center">Clear filters</CommandItem></CommandGroup>{/if}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {#if statusFilter.length || search}<Button variant="ghost" onclick={resetFilters} class="h-8 px-2 lg:px-3">Reset <XIcon class="ml-2 h-4 w-4" /></Button>{/if}
    </div>
  </div>

  <div class="overflow-hidden rounded-md border">
    <Table>
      <TableHeader>
        <TableRow class="group/row">
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted w-10"><Checkbox checked={allSelected} indeterminate={someSelected} onCheckedChange={toggleAll} aria-label="Select all" class="translate-y-0.5" /></TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted"><span class="text-xs font-medium text-muted-foreground">Title</span></TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted"><span class="text-xs font-medium text-muted-foreground">Status</span></TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted"><span class="text-xs font-medium text-muted-foreground">Views</span></TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted"><span class="text-xs font-medium text-muted-foreground">Date</span></TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if loading}
          <TableRow><TableCell colspan={6} class="h-24 text-center text-muted-foreground">Loading...</TableCell></TableRow>
        {:else if paged.length === 0}
          <TableRow><TableCell colspan={6} class="h-24 text-center text-muted-foreground">No posts.</TableCell></TableRow>
        {:else}
          {#each paged as post (post.id)}
            <TableRow data-state={rowSelection.has(post.id) && 'selected'} class="group/row">
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted"><Checkbox checked={rowSelection.has(post.id)} onCheckedChange={() => toggle(post.id)} aria-label="Select row" class="translate-y-0.5" /></TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted font-medium max-w-xs truncate">{post.title}</TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted"><Badge variant="outline" class="capitalize {statusColors[post.status] || ''}">{post.status}</Badge></TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted text-sm text-muted-foreground">{post.viewCount}</TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted text-sm text-muted-foreground">
                {post.createdAt.includes('datetime') ? 'Just now' : new Date(post.createdAt).toLocaleDateString('id-ID')}
              </TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="ghost" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                      <Ellipsis class="h-4 w-4" />
                      <span class="sr-only">Open menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-40">
                    <DropdownMenuItem onclick={() => goto(`/admin/posts/${post.id}`)}>
                      Edit
                      <span class="ml-auto"><Pencil size={16} /></span>
                    </DropdownMenuItem>
                    
                    {#if post.status === 'draft'}
                      <DropdownMenuItem onclick={() => updateStatus(post.id, 'publish')}>
                        Publish
                        <span class="ml-auto"><Send size={16} /></span>
                      </DropdownMenuItem>
                    {:else if post.status === 'publish'}
                      <DropdownMenuItem onclick={() => updateStatus(post.id, 'draft')}>
                        Back to Draft
                        <span class="ml-auto"><FileText size={16} /></span>
                      </DropdownMenuItem>
                    {/if}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem class="text-red-500 focus:text-red-500!" onclick={() => deleteId = post.id}>
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

<AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) deleteId = null }}>
  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete post?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onclick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
</AlertDialog>
{:else}
  <div class="flex flex-1 flex-col gap-4"><div class="flex items-center justify-center h-24 text-muted-foreground">Loading...</div></div>
{/if}
