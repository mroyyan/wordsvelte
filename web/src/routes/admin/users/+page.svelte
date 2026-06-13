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
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '$lib/components/ui/dialog'
  import { Label } from '$lib/components/ui/label'
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
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import XIcon from '@lucide/svelte/icons/x'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
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
  let createOpen = $state(false); let roleOpen = $state(false)
  let newEmail = $state(''); let newUsername = $state(''); let newPassword = $state(''); let newDisplayName = $state(''); let newRole = $state('author')
  let saving = $state(false); let createError = $state('')

  let editOpen = $state(false); let editRoleOpen = $state(false)
  let editUser = $state<any | null>(null)
  let editDisplayName = $state(''); let editEmail = $state(''); let editRole = $state('')
  let editError = $state('')

  const selectedRoleLabel = $derived(roleOptions.find(r => r.value === newRole)?.label || 'Author')
  const editRoleLabel = $derived(roleOptions.find(r => r.value === editRole)?.label || 'Author')

  function isProtected(u: any) { return u.id === 1 }

  function t() { return localStorage.getItem('wordsvelte_token') }

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

  function openCreate() { newEmail = ''; newUsername = ''; newPassword = ''; newDisplayName = ''; newRole = 'author'; createError = ''; createOpen = true }

  async function handleCreate() {
    if (!newEmail || !newUsername || !newPassword || !newDisplayName) { createError = 'All fields required'; return }
    const tok = t(); if (!tok) return
    saving = true; createError = ''
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, username: newUsername, password: newPassword, displayName: newDisplayName, role: newRole }),
      })
      const json = await res.json()
      if (!json.success) { createError = json.error || 'Failed'; return }
      data = [...data, json.data.user]
      createOpen = false
    } catch (e: any) { createError = e.message }
    finally { saving = false }
  }

  function openEdit(u: any) {
    editUser = u; editDisplayName = u.displayName; editEmail = u.email; editRole = u.role; editError = ''; editOpen = true
  }

  async function handleEdit() {
    if (!editDisplayName || !editEmail) { editError = 'Display name and email required'; return }
    const tok = t(); if (!tok) return
    saving = true; editError = ''
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ displayName: editDisplayName, email: editEmail, role: editRole }),
      })
      const json = await res.json()
      if (!json.success) { editError = json.error || 'Failed'; return }
      data = data.map((u: any) => u.id === editUser.id ? { ...u, ...json.data } : u)
      editOpen = false
    } catch (e: any) { editError = e.message }
    finally { saving = false }
  }

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
    <Button size="lg" class="gap-2 px-4" onclick={openCreate}><span>Add User</span> <UserPlus size={18} /></Button>
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
                    <DropdownMenuItem onclick={() => openEdit(user)} disabled={isProtected(user)}>
                      Edit
                      <span class="ml-auto"><UserPen size={16} /></span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem class="text-red-500!" disabled={isProtected(user)}>
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

<Dialog open={createOpen} onOpenChange={(o) => { if (!o) createOpen = false }}>
  <DialogContent class="sm:max-w-sm">
    <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
    <div class="space-y-4 py-4">
      <div class="space-y-2"><Label for="nu-email">Email</Label><Input id="nu-email" type="email" bind:value={newEmail} placeholder="user@example.com" /></div>
      <div class="space-y-2"><Label for="nu-username">Username</Label><Input id="nu-username" bind:value={newUsername} placeholder="username" /></div>
      <div class="space-y-2"><Label for="nu-display">Display Name</Label><Input id="nu-display" bind:value={newDisplayName} placeholder="Display Name" /></div>
      <div class="space-y-2"><Label for="nu-password">Password</Label><Input id="nu-password" type="password" bind:value={newPassword} placeholder="********" /></div>
      <div class="space-y-2">
        <Label>Role</Label>
        <Popover open={roleOpen} onOpenChange={(o) => roleOpen = o}>
          <PopoverTrigger>
            <Button variant="outline" class="w-full justify-start font-normal">
              {#if newRole === 'admin'}<Shield class="mr-2 h-4 w-4 text-muted-foreground" />{:else if newRole === 'editor'}<UserCheck class="mr-2 h-4 w-4 text-muted-foreground" />{:else}<Edit3 class="mr-2 h-4 w-4 text-muted-foreground" />{/if}
              {selectedRoleLabel}
              <ChevronDown class="ml-auto h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-48 p-0" align="start">
            <div class="p-1">
              {#each roleOptions as opt}
                <button
                  class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onclick={() => { newRole = opt.value; roleOpen = false }}
                >
                  <opt.icon class="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{opt.label}</span>
                  {#if newRole === opt.value}<Check class="ml-auto h-4 w-4 shrink-0" />{/if}
                </button>
              {/each}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {#if createError}<p class="text-sm text-destructive">{createError}</p>{/if}
    </div>
    <DialogFooter>
      <Button variant="outline" onclick={() => createOpen = false}>Cancel</Button>
      <Button onclick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog open={editOpen} onOpenChange={(o) => { if (!o) editOpen = false }}>
  <DialogContent class="sm:max-w-sm">
    <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
    <div class="space-y-4 py-4">
      {#if editUser}
        <div class="space-y-2"><Label>Username</Label><Input value={editUser.username} disabled class="opacity-60" /></div>
      {/if}
      <div class="space-y-2"><Label for="ed-email">Email</Label><Input id="ed-email" type="email" bind:value={editEmail} placeholder="user@example.com" /></div>
      <div class="space-y-2"><Label for="ed-display">Display Name</Label><Input id="ed-display" bind:value={editDisplayName} placeholder="Display Name" /></div>
      <div class="space-y-2">
        <Label>Role</Label>
        <Popover open={editRoleOpen} onOpenChange={(o) => editRoleOpen = o}>
          <PopoverTrigger>
            <Button variant="outline" class="w-full justify-start font-normal">
              {#if editRole === 'admin'}<Shield class="mr-2 h-4 w-4 text-muted-foreground" />{:else if editRole === 'editor'}<UserCheck class="mr-2 h-4 w-4 text-muted-foreground" />{:else}<Edit3 class="mr-2 h-4 w-4 text-muted-foreground" />{/if}
              {editRoleLabel}
              <ChevronDown class="ml-auto h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-48 p-0" align="start">
            <div class="p-1">
              {#each roleOptions as opt}
                <button
                  class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onclick={() => { editRole = opt.value; editRoleOpen = false }}
                >
                  <opt.icon class="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{opt.label}</span>
                  {#if editRole === opt.value}<Check class="ml-auto h-4 w-4 shrink-0" />{/if}
                </button>
              {/each}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {#if editError}<p class="text-sm text-destructive">{editError}</p>{/if}
    </div>
    <DialogFooter>
      <Button variant="outline" onclick={() => editOpen = false}>Cancel</Button>
      <Button onclick={handleEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

{:else}
  <div class="flex flex-1 flex-col gap-4"><div class="flex items-center justify-center h-24 text-muted-foreground">Loading...</div></div>
{/if}

