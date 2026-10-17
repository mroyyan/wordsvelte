<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import ShieldIcon from '@lucide/svelte/icons/shield'
  import UserCheckIcon from '@lucide/svelte/icons/user-check'
  import PencilLineIcon from '@lucide/svelte/icons/pencil-line'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import UserPenIcon from '@lucide/svelte/icons/user-pen'
  import EllipsisIcon from '@lucide/svelte/icons/ellipsis'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Badge } from '$lib/components/ui/badge'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import * as Select from '$lib/components/ui/select'
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu'
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '$lib/components/ui/dialog'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import PrimaryButton from '$lib/components/layout/primary-button.svelte'
  import { fetchAll } from '$lib/client/admin-api'
  import PasswordInput from '$lib/components/auth/password-input.svelte'
  import {
    DataTableState, DataTableToolbar, DataTableFacetedFilter, DataTableColumnHeader, DataTablePagination,
  } from '$lib/components/data-table'

  interface UserRow { id: number; email: string; username: string; displayName: string; role: 'admin' | 'editor' | 'author'; createdAt: string }

  const roleOptions = [
    { label: 'Admin', value: 'admin', icon: ShieldIcon },
    { label: 'Editor', value: 'editor', icon: UserCheckIcon },
    { label: 'Author', value: 'author', icon: PencilLineIcon },
  ]
  const roleIcon = (role: string) => roleOptions.find(r => r.value === role)?.icon ?? PencilLineIcon
  const columns = [
    { id: 'username', title: 'Username' },
    { id: 'displayName', title: 'Name', secondary: true },
    { id: 'email', title: 'Email', secondary: true },
    { id: 'role', title: 'Role', secondary: true },
  ]

  const table = new DataTableState<UserRow>({
    getId: u => u.id,
    searchFields: [u => u.username, u => u.displayName, u => u.email],
    filterAccessors: { role: u => u.role },
    sortAccessors: { username: u => u.username, displayName: u => u.displayName, email: u => u.email, role: u => u.role },
  })

  let loading = $state(true)
  let loadError = $state('')
  let saving = $state(false)

  // create dialog
  let createOpen = $state(false)
  let form = $state({ email: '', username: '', displayName: '', password: '', role: 'author' })
  let createError = $state('')

  // edit dialog
  let editUser = $state<UserRow | null>(null)
  let edit = $state({ email: '', displayName: '', role: 'author' })
  let editError = $state('')

  // The primary admin (id 1) is protected by the API; hide the action instead of offering something that will 403.
  const isProtected = (u: UserRow) => u.id === 1
  const token = () => localStorage.getItem('wordsvelte_token')
  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` })

  async function load() {
    loading = true; loadError = ''
    try {
      table.setRows(await fetchAll<UserRow>('/api/users', 100))
    } catch (e: any) { loadError = e.message } finally { loading = false }
  }
  onMount(load)

  function openCreate() {
    form = { email: '', username: '', displayName: '', password: '', role: 'author' }
    createError = ''; createOpen = true
  }

  async function handleCreate(e: Event) {
    e.preventDefault()
    saving = true; createError = ''
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: authHeaders(), body: JSON.stringify(form) })
      const json = await res.json()
      if (!json.success) { createError = json.error || 'Failed to create user'; return }
      table.setRows([json.data.user, ...table.rows])
      createOpen = false
      toast.success(`Created ${json.data.user.username}`)
    } catch (err: any) { createError = err.message } finally { saving = false }
  }

  function openEdit(u: UserRow) {
    editUser = u
    edit = { email: u.email, displayName: u.displayName, role: u.role }
    editError = ''
  }

  async function handleEdit(e: Event) {
    e.preventDefault()
    if (!editUser) return
    saving = true; editError = ''
    try {
      const res = await fetch(`/api/users/${editUser.id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(edit) })
      const json = await res.json()
      if (!json.success) { editError = json.error || 'Failed to update user'; return }
      table.setRows(table.rows.map(r => (r.id === json.data.id ? { ...r, ...json.data } : r)))
      toast.success('User updated')
      editUser = null
    } catch (err: any) { editError = err.message } finally { saving = false }
  }

  const visibleColumns = $derived(columns.filter(c => table.isVisible(c.id)))
</script>

<svelte:head><title>Users</title></svelte:head>

<div class="flex flex-1 flex-col gap-4">
  <PageHeader title="User List" description="Manage your users and their roles here.">
    {#snippet actions()}
      <PrimaryButton label="Add User" icon={UserPlusIcon} onclick={openCreate} />
    {/snippet}
  </PageHeader>

  <DataTableToolbar {table} searchPlaceholder="Filter users..." {columns}>
    {#snippet filters()}
      <DataTableFacetedFilter
        title="Role"
        options={roleOptions}
        selected={table.filters.role ?? []}
        counts={table.counts('role')}
        onChange={(v) => table.setFilter('role', v)}
      />
    {/snippet}
  </DataTableToolbar>

  {#if loadError}
    <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>
  {/if}

  <div class="overflow-hidden rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-10">
            <Checkbox checked={table.allOnPageSelected} indeterminate={table.someOnPageSelected} onCheckedChange={() => table.toggleAllOnPage()} aria-label="Select all" class="translate-y-0.5" />
          </TableHead>
          {#each visibleColumns as c (c.id)}
            <TableHead class={c.secondary ? 'hidden sm:table-cell' : ''}><DataTableColumnHeader {table} column={c.id} title={c.title} /></TableHead>
          {/each}
          <TableHead class="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#if loading}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center text-muted-foreground"><Loader2Icon class="mx-auto size-4 animate-spin" /></TableCell></TableRow>
        {:else if table.pageRows.length === 0}
          <TableRow><TableCell colspan={visibleColumns.length + 2} class="h-24 text-center text-muted-foreground">No results.</TableCell></TableRow>
        {:else}
          {#each table.pageRows as user (user.id)}
            {@const RoleIcon = roleIcon(user.role)}
            <TableRow data-state={table.isSelected(user) ? 'selected' : undefined}>
              <TableCell><Checkbox checked={table.isSelected(user)} onCheckedChange={() => table.toggleRow(user)} aria-label="Select row" class="translate-y-0.5" /></TableCell>
              {#each visibleColumns as c (c.id)}
                <TableCell class={[c.id === 'username' ? 'max-w-[15rem] font-medium sm:max-w-40' : c.id === 'email' ? 'text-nowrap' : 'max-w-40 truncate', c.secondary && 'hidden sm:table-cell']}>
                  {#if c.id === 'role'}
                    <Badge variant="outline" class="flex w-fit items-center gap-1 capitalize"><RoleIcon class="size-3 text-muted-foreground" />{user.role}</Badge>
                  {:else if c.id === 'username'}
                    <div class="truncate">{user.username}</div>
                    <div class="mt-0.5 truncate text-xs font-normal text-muted-foreground sm:hidden">{user.displayName} · {user.email}</div>
                    <Badge variant="outline" class="mt-1 flex w-fit items-center gap-1 capitalize sm:hidden"><RoleIcon class="size-3 text-muted-foreground" />{user.role}</Badge>
                  {:else}
                    {user[c.id as 'username' | 'displayName' | 'email']}
                  {/if}
                </TableCell>
              {/each}
              <TableCell>
                {#if !isProtected(user)}
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      {#snippet child({ props })}
                        <Button {...props} variant="ghost" class="flex size-8 p-0 data-[state=open]:bg-muted">
                          <EllipsisIcon class="size-4" /><span class="sr-only">Open menu</span>
                        </Button>
                      {/snippet}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-40">
                      <DropdownMenuItem onclick={() => openEdit(user)}>Edit <span class="ms-auto"><UserPenIcon class="size-4" /></span></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                {/if}
              </TableCell>
            </TableRow>
          {/each}
        {/if}
      </TableBody>
    </Table>
  </div>

  <DataTablePagination {table} class="mt-auto" />
</div>

<!-- Add user -->
<Dialog open={createOpen} onOpenChange={(o) => (createOpen = o)}>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Add User</DialogTitle>
      <DialogDescription>They can sign in right away with this password; ask them to change it via Forgot password.</DialogDescription>
    </DialogHeader>
    <form onsubmit={handleCreate} class="grid gap-4">
      <div class="grid gap-2"><Label for="nu-display">Display name</Label><Input id="nu-display" bind:value={form.displayName} required /></div>
      <div class="grid gap-2"><Label for="nu-username">Username</Label><Input id="nu-username" bind:value={form.username} autocomplete="off" required /></div>
      <div class="grid gap-2"><Label for="nu-email">Email</Label><Input id="nu-email" type="email" bind:value={form.email} autocomplete="off" required /></div>
      <div class="grid gap-2"><Label for="nu-password">Password</Label><PasswordInput id="nu-password" bind:value={form.password} autocomplete="new-password" minlength={8} placeholder="At least 8 characters" /></div>
      <div class="grid gap-2">
        <Label>Role</Label>
        <Select.Root type="single" bind:value={form.role}>
          <Select.Trigger class="w-full capitalize">{form.role}</Select.Trigger>
          <Select.Content>
            {#each roleOptions as o (o.value)}<Select.Item value={o.value} label={o.label}>{o.label}</Select.Item>{/each}
          </Select.Content>
        </Select.Root>
      </div>
      {#if createError}<Alert variant="destructive"><AlertDescription>{createError}</AlertDescription></Alert>{/if}
      <DialogFooter>
        <Button type="button" variant="outline" onclick={() => (createOpen = false)}>Cancel</Button>
        <Button type="submit" disabled={saving}>{#if saving}<Loader2Icon class="animate-spin" />{/if} Create</Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>

<!-- Edit user -->
<Dialog open={editUser !== null} onOpenChange={(o) => { if (!o) editUser = null }}>
  <DialogContent class="sm:max-w-md">
    <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
    {#if editUser}
      <form onsubmit={handleEdit} class="grid gap-4">
        <div class="grid gap-2"><Label>Username</Label><Input value={editUser.username} disabled class="opacity-60" /></div>
        <div class="grid gap-2"><Label for="ed-display">Display name</Label><Input id="ed-display" bind:value={edit.displayName} required /></div>
        <div class="grid gap-2"><Label for="ed-email">Email</Label><Input id="ed-email" type="email" bind:value={edit.email} required /></div>
        <div class="grid gap-2">
          <Label>Role</Label>
          <Select.Root type="single" bind:value={edit.role}>
            <Select.Trigger class="w-full capitalize">{edit.role}</Select.Trigger>
            <Select.Content>
              {#each roleOptions as o (o.value)}<Select.Item value={o.value} label={o.label}>{o.label}</Select.Item>{/each}
            </Select.Content>
          </Select.Root>
        </div>
        {#if editError}<Alert variant="destructive"><AlertDescription>{editError}</AlertDescription></Alert>{/if}
        <DialogFooter>
          <Button type="button" variant="outline" onclick={() => (editUser = null)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{#if saving}<Loader2Icon class="animate-spin" />{/if} Save</Button>
        </DialogFooter>
      </form>
    {/if}
  </DialogContent>
</Dialog>
