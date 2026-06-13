<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
  } from '$lib/components/ui/table'
  import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
  } from '$lib/components/ui/dropdown-menu'
  import {
    Popover, PopoverContent, PopoverTrigger
  } from '$lib/components/ui/popover'
  import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator
  } from '$lib/components/ui/command'
  import { Separator } from '$lib/components/ui/separator'
  import Shield from '@lucide/svelte/icons/shield'
  import UserCheck from '@lucide/svelte/icons/user-check'
  import Edit3 from '@lucide/svelte/icons/edit-3'
  import ChevronLeft from '@lucide/svelte/icons/chevron-left'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import ChevronsLeft from '@lucide/svelte/icons/chevrons-left'
  import ChevronsRight from '@lucide/svelte/icons/chevrons-right'
  import Check from '@lucide/svelte/icons/check'
  import PlusCircle from '@lucide/svelte/icons/plus-circle'
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import UserPen from '@lucide/svelte/icons/user-pen'
  import UserPlus from '@lucide/svelte/icons/user-plus'
  import MailPlus from '@lucide/svelte/icons/mail-plus'
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import XIcon from '@lucide/svelte/icons/x'
  import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down'
  import ArrowUp from '@lucide/svelte/icons/arrow-up'
  import ArrowDown from '@lucide/svelte/icons/arrow-down'

  let mounted = $state(false)
  onMount(() => { mounted = true })

  const roleOptions = [
    { label: 'Admin', value: 'admin', icon: Shield },
    { label: 'Editor', value: 'editor', icon: UserCheck },
    { label: 'Author', value: 'author', icon: Edit3 },
  ]

  let data = $state<any[]>([])
  let loading = $state(true)
  let globalFilter = $state('')
  let roleFilter = $state<string[]>([])
  let page = $state(1)
  let pageSize = $state(10)
  let total = $state(0)
  let rowSelection = $state<Set<number>>(new Set())
  let sorting = $state<{ id: string; desc: boolean }[]>([])
  let columnVisibility = $state<Record<string, boolean>>({})

  function t() { return localStorage.getItem('kubus_token') }

  onMount(async () => {
    const tok = t()
    if (!tok) return
    try {
      const r = await fetch('/api/users', { headers: { Authorization: `Bearer ${tok}` } })
      const j = await r.json()
      data = j.data ?? []
      total = j.total || data.length
    } catch {} finally { loading = false }
  })

  function getSortedData() {
    let result = data
    if (globalFilter) {
      const q = globalFilter.toLowerCase()
      result = result.filter(u => u.username?.toLowerCase().includes(q))
    }
    if (roleFilter.length) result = result.filter(u => roleFilter.includes(u.role))
    if (sorting.length) {
      const { id, desc } = sorting[0]
      result = [...result].sort((a, b) => {
        const av = (a[id] || '').toString(), bv = (b[id] || '').toString()
        return desc ? bv.localeCompare(av) : av.localeCompare(bv)
      })
    }
    return result
  }

  let filtered = $derived(getSortedData())
  let totalPages = $derived(Math.ceil(filtered.length / pageSize) || 1)
  let paged = $derived(filtered.slice((page - 1) * pageSize, page * pageSize))
  let allSelected = $derived(paged.length > 0 && paged.every(r => rowSelection.has(r.id)))
  let someSelected = $derived(paged.some(r => rowSelection.has(r.id)) && !allSelected)

  function toggleAll() {
    if (allSelected) { paged.forEach(r => rowSelection.delete(r.id)); rowSelection = new Set(rowSelection) }
    else { paged.forEach(r => rowSelection.add(r.id)); rowSelection = new Set(rowSelection) }
  }
  function toggle(id: number) {
    if (rowSelection.has(id)) {
      rowSelection.delete(id)
    } else {
      rowSelection.add(id)
    }
    rowSelection = new Set(rowSelection)
  }

  function toggleSort(id: string) {
    if (sorting.length && sorting[0].id === id) {
      sorting = [{ id, desc: !sorting[0].desc }]
    } else {
      sorting = [{ id, desc: false }]
    }
  }

  function SortIcon({ id }: { id: string }) {
    const s = sorting.find(s => s.id === id)
    if (!s) return ArrowUpDown
    return s.desc ? ArrowDown : ArrowUp
  }

  function resetFilters() { globalFilter = ''; roleFilter = []; page = 1 }
  let isFiltered = $derived(globalFilter || roleFilter.length)

  const totalRows = $derived(rowSelection.size)

  function getPageNumbers(): (number | '...')[] {
    const total = totalPages
    const current = page
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
    if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
    return [1, '...', current - 1, current, current + 1, '...', total]
  }
</script>

{#if mounted}
<div class="flex flex-1 flex-col gap-4">
  <div class="flex flex-wrap items-end justify-between gap-2">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">User List</h2>
      <p class="text-muted-foreground">Manage your users and their roles here.</p>
    </div>
    <div class="flex gap-2">
      <Button variant="outline" size="lg" class="gap-2 px-4"><span>Invite User</span> <MailPlus size={18} /></Button>
      <Button size="lg" class="gap-2 px-4"><span>Add User</span> <UserPlus size={18} /></Button>
    </div>
  </div>

  <div class="flex items-center justify-between">
    <div class="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
      <Input
        placeholder="Filter users..."
        bind:value={globalFilter}
        class="h-8 w-37.5 lg:w-62.5"
        oninput={() => page = 1}
      />
      <div class="flex gap-x-2">
        <Popover>
          <PopoverTrigger>
            <Button variant="outline" class="h-8 border-dashed">
              <PlusCircle class="mr-2 h-4 w-4" /> Role
              {#if roleFilter.length}<div class="ml-1 rounded bg-secondary px-1 text-xs font-medium">{roleFilter.length}</div>{/if}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-48 p-0" align="start">
            <Command class="p-0 [&_[cmdk-input-wrapper]]:p-0 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:p-[1px] [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-9 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-1.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
              <CommandInput placeholder="Filter role..." />
              <CommandList>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup>
                  {#each roleOptions as opt}
                    <CommandItem onselect={() => { roleFilter = roleFilter.includes(opt.value) ? roleFilter.filter(r => r !== opt.value) : [...roleFilter, opt.value]; page = 1 }}>
                      <div class="mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary">
                        {#if roleFilter.includes(opt.value)}<Check class="h-3 w-3" />{/if}
                      </div>
                      <opt.icon class="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{opt.label}</span>
                      <span class="ml-auto text-xs text-muted-foreground">{data.filter(u => u.role === opt.value).length}</span>
                    </CommandItem>
                  {/each}
                </CommandGroup>
                {#if roleFilter.length}
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onselect={resetFilters} class="justify-center text-center">
                      Clear filters
                    </CommandItem>
                  </CommandGroup>
                {/if}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {#if isFiltered}
        <Button variant="ghost" onclick={resetFilters} class="h-8 px-2 lg:px-3">
          Reset <XIcon class="ml-2 h-4 w-4" />
        </Button>
      {/if}
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="outline" size="icon" class="h-8 w-8"><SlidersHorizontal class="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-40">
        <DropdownMenuItem onselect={() => columnVisibility = {}}>
          <Check class="mr-2 h-4 w-4" /> Username
        </DropdownMenuItem>
        <DropdownMenuItem onselect={() => columnVisibility = { ...columnVisibility, displayName: !columnVisibility.displayName }}>
          <Check class="mr-2 h-4 w-4" /> Name
        </DropdownMenuItem>
        <DropdownMenuItem onselect={() => columnVisibility = { ...columnVisibility, email: !columnVisibility.email }}>
          <Check class="mr-2 h-4 w-4" /> Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <div class="overflow-hidden rounded-md border">
    <Table>
      <TableHeader>
        <TableRow class="group/row">
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted w-10">
            <Checkbox
              checked={allSelected} indeterminate={someSelected}
              onCheckedChange={toggleAll}
              aria-label="Select all"
              class="translate-y-0.5"
            />
          </TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted">
            <button onclick={() => toggleSort('username')} class="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Username
              {#if sorting.find(s => s.id === 'username')?.desc}
                <ArrowDown class="h-3 w-3" />
              {:else if sorting.find(s => s.id === 'username')}
                <ArrowUp class="h-3 w-3" />
              {:else}
                <ArrowUpDown class="h-3 w-3" />
              {/if}
            </button>
          </TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted w-36">
            <button onclick={() => toggleSort('displayName')} class="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Name
              {#if sorting.find(s => s.id === 'displayName')?.desc}
                <ArrowDown class="h-3 w-3" />
              {:else if sorting.find(s => s.id === 'displayName')}
                <ArrowUp class="h-3 w-3" />
              {:else}
                <ArrowUpDown class="h-3 w-3" />
              {/if}
            </button>
          </TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted">
            <button onclick={() => toggleSort('email')} class="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Email
              {#if sorting.find(s => s.id === 'email')?.desc}
                <ArrowDown class="h-3 w-3" />
              {:else if sorting.find(s => s.id === 'email')}
                <ArrowUp class="h-3 w-3" />
              {:else}
                <ArrowUpDown class="h-3 w-3" />
              {/if}
            </button>
          </TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted">
            <span class="text-xs font-medium text-muted-foreground">Role</span>
          </TableHead>
          <TableHead class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if loading}
          <TableRow><TableCell colspan={6} class="h-24 text-center text-muted-foreground">Loading...</TableCell></TableRow>
        {:else if paged.length === 0}
          <TableRow><TableCell colspan={6} class="h-24 text-center text-muted-foreground">No results.</TableCell></TableRow>
        {:else}
          {#each paged as user (user.id)}
            <TableRow data-state={rowSelection.has(user.id) && 'selected'} class="group/row">
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted">
                <Checkbox checked={rowSelection.has(user.id)} onCheckedChange={() => toggle(user.id)} aria-label="Select row" class="translate-y-0.5" />
              </TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted font-medium max-w-36 truncate">{user.username}</TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted max-w-36 truncate">{user.displayName}</TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted text-nowrap">{user.email}</TableCell>
              <TableCell class="bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted">
                <Badge variant="outline" class="flex items-center gap-1 w-fit capitalize">
                  {#if user.role === 'admin'}<Shield class="h-3 w-3 text-muted-foreground" />{:else if user.role === 'editor'}<UserCheck class="h-3 w-3 text-muted-foreground" />{:else}<Edit3 class="h-3 w-3 text-muted-foreground" />{/if}
                  {user.role}
                </Badge>
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
                    <DropdownMenuItem>
                      Edit
                      <span class="ml-auto"><UserPen size={16} /></span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem class="text-red-500!">
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
        <select class="h-8 w-17.5 rounded-md border border-input bg-transparent px-2 text-sm" bind:value={pageSize} onchange={() => page = 1}>
          {#each [10, 20, 30, 40, 50] as size}<option value={size}>{size}</option>{/each}
        </select>
        <p class="hidden text-sm font-medium sm:block">Rows per page</p>
      </div>
    </div>
    <div class="flex items-center sm:space-x-6 lg:space-x-8">
      {#if totalPages > 1}
        <div class="flex w-25 items-center justify-center text-sm font-medium @max-3xl/content:hidden">Page {page} of {totalPages}</div>
      {/if}
      <div class="flex items-center space-x-2">
        <Button variant="outline" class="size-8 p-0 @max-md/content:hidden" disabled={page <= 1} onclick={() => page = 1}><ChevronsLeft class="h-4 w-4" /><span class="sr-only">Go to first page</span></Button>
        <Button variant="outline" class="size-8 p-0" disabled={page <= 1} onclick={() => page = Math.max(1, page - 1)}><ChevronLeft class="h-4 w-4" /><span class="sr-only">Go to previous page</span></Button>
        {#each getPageNumbers() as pn}
          {#if pn === '...'}
            <span class="px-1 text-sm text-muted-foreground">...</span>
          {:else}
            <Button variant={page === pn ? 'default' : 'outline'} class="h-8 min-w-8 px-2" onclick={() => page = pn as number}>{pn}</Button>
          {/if}
        {/each}
        <Button variant="outline" class="size-8 p-0" disabled={page >= totalPages} onclick={() => page = Math.min(totalPages, page + 1)}><ChevronRight class="h-4 w-4" /><span class="sr-only">Go to next page</span></Button>
        <Button variant="outline" class="size-8 p-0 @max-md/content:hidden" disabled={page >= totalPages} onclick={() => page = totalPages}><ChevronsRight class="h-4 w-4" /><span class="sr-only">Go to last page</span></Button>
      </div>
    </div>
  </div>

  {#if totalRows > 0}
    <div class="flex items-center gap-2 px-2">
      <span class="text-sm text-muted-foreground">{totalRows} selected</span>
      <Button variant="outline" size="icon" class="size-8" aria-label="Clear selection" onclick={() => rowSelection = new Set()}>
        <XIcon class="h-4 w-4" />
      </Button>
    </div>
  {/if}
</div>
{:else}
  <div class="flex flex-1 flex-col gap-4"><div class="flex items-center justify-center h-24 text-muted-foreground">Loading...</div></div>
{/if}

