<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$lib/components/ui/select'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '$lib/components/ui/dialog'
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '$lib/components/ui/alert-dialog'
  import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
  } from '$lib/components/ui/dropdown-menu'
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs'
  import { Plus, Link, ExternalLink, Home, Mail, Info } from '@lucide/svelte'
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import Pencil from '@lucide/svelte/icons/pencil'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import ArrowUp from '@lucide/svelte/icons/arrow-up'
  import ArrowDown from '@lucide/svelte/icons/arrow-down'

  let mounted = $state(false)
  onMount(() => { mounted = true })

  let menus = $state<any[]>([])
  let loading = $state(true)
  let activeMenuId = $state<number | null>(null)

  // Menu form
  let menuDialogOpen = $state(false)
  let editMenu = $state<any | null>(null)
  let menuName = $state('')
  let menuLocation = $state('header')

  // Menu item form
  let itemDialogOpen = $state(false)
  let editItem = $state<any | null>(null)
  let itemLabel = $state('')
  let itemUrl = $state('')
  let itemType = $state('custom')
  let itemParentId = $state<number | null>(null)

  let deleteMenuId = $state<number | null>(null)
  let deleteItemId = $state<number | null>(null)
  let parentItemValue = $state('')

  const locationLabels: Record<string, string> = {
    header: 'Header (Main Navigation)',
    footer: 'Footer',
    sidebar: 'Sidebar',
  }

  const presetItems = [
    { label: 'Home', url: '/', icon: Home },
    { label: 'About', url: '/about', icon: Info },
    { label: 'Contact', url: '/contact', icon: Mail },
  ]

  const footerPresetItems = [
    { label: 'Privacy Policy', url: '/privacy-policy' },
    { label: 'Terms of Service', url: '/terms' },
    { label: 'Disclaimer', url: '/disclaimer' },
    { label: 'Pedoman Media Siber', url: '/pedoman-media-siber' },
    { label: 'Redaksi', url: '/redaksi' },
    { label: 'Karir', url: '/karir' },
  ]

  function t() { return localStorage.getItem('kubus_token') }

  async function load() {
    const tok = t(); if (!tok) return
    try {
      const r = await fetch('/api/menus', { headers: { Authorization: `Bearer ${tok}` } })
      const j = await r.json()
      menus = j.data ?? []
      if (menus.length > 0 && !activeMenuId) activeMenuId = menus[0].id
    } catch {} finally { loading = false }
  }

  onMount(load)

  let activeMenu = $derived(menus.find(m => m.id === activeMenuId) || null)
  let rootItems = $derived(activeMenu ? activeMenu.items.filter((i: any) => !i.parentId) : [])
  let childItems = $derived(activeMenu ? activeMenu.items.filter((i: any) => i.parentId) : [])

  function getChildren(parentId: number) {
    return childItems.filter((i: any) => i.parentId === parentId)
  }

  // Menu CRUD
  function openCreateMenu() { editMenu = null; menuName = ''; menuLocation = 'header'; menuDialogOpen = true }
  function openEditMenu(menu: any) { editMenu = menu; menuName = menu.name; menuLocation = menu.location; menuDialogOpen = true }

  async function moveItem(item: any, direction: 'up' | 'down') {
    const parentItems = item.parentId ? childItems.filter((i: any) => i.parentId === item.parentId) : rootItems
    const idx = parentItems.findIndex((i: any) => i.id === item.id)
    if (idx === -1) return
    const swapWith = direction === 'up' ? parentItems[idx - 1] : parentItems[idx + 1]
    if (!swapWith) return
    const tok = t(); if (!tok) return
    try {
      await Promise.all([
        fetch(`/api/menu-items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ sortOrder: swapWith.sortOrder }) }),
        fetch(`/api/menu-items/${swapWith.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ sortOrder: item.sortOrder }) }),
      ])
      await load()
    } catch (e: any) { alert(e.message) }
  }

  async function handleSaveMenu() {
    if (!menuName.trim()) return; const tok = t(); if (!tok) return
    try {
      if (editMenu) {
        const r = await fetch(`/api/menus/${editMenu.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ name: menuName, location: menuLocation }) })
        const j = await r.json()
        if (j.data) menus = menus.map((m: any) => m.id === editMenu.id ? j.data : m)
      } else {
        const r = await fetch('/api/menus', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ name: menuName, location: menuLocation }) })
        const j = await r.json()
        if (j.data) { menus = [...menus, j.data]; activeMenuId = j.data.id }
      }
      menuDialogOpen = false
    } catch (e: any) { alert(e.message) }
  }

  async function handleDeleteMenu() {
    if (!deleteMenuId) return; const tok = t(); if (!tok) return
    try {
      await fetch(`/api/menus/${deleteMenuId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } })
      menus = menus.filter((m: any) => m.id !== deleteMenuId)
      if (activeMenuId === deleteMenuId) activeMenuId = menus.length > 0 ? menus[0].id : null
    } catch (e: any) { alert(e.message) } finally { deleteMenuId = null }
  }

  // Item CRUD
  function openCreateItem(type = 'custom') {
    editItem = null; itemType = type; itemLabel = ''; itemUrl = ''; itemParentId = null; parentItemValue = ''; itemDialogOpen = true
  }

  function openCreatePreset(label: string, url: string) {
    editItem = null; itemType = 'custom'; itemLabel = label; itemUrl = url; itemParentId = null; parentItemValue = ''; itemDialogOpen = true
  }

  function openEditItem(item: any) {
    editItem = item; itemType = item.itemType; itemLabel = item.label; itemUrl = item.url || ''; itemParentId = item.parentId; parentItemValue = item.parentId?.toString() || ''; itemDialogOpen = true
  }

  async function handleSaveItem() {
    if (!itemLabel.trim() || !activeMenuId) return; const tok = t(); if (!tok) return
    try {
      if (editItem) {
        const r = await fetch(`/api/menu-items/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ label: itemLabel, url: itemUrl || null, itemType, parentId: itemParentId }) })
        const j = await r.json()
        if (j.data) {
          const menu = menus.find(m => m.id === activeMenuId)
          if (menu) {
            menu.items = menu.items.map((i: any) => i.id === editItem.id ? j.data : i)
            menus = [...menus]
          }
        }
      } else {
        const r = await fetch(`/api/menus/${activeMenuId}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ label: itemLabel, url: itemUrl || null, itemType, parentId: itemParentId }) })
        const j = await r.json()
        if (j.data) {
          const menu = menus.find(m => m.id === activeMenuId)
          if (menu) { menu.items = [...menu.items, j.data]; menus = [...menus] }
        }
      }
      itemDialogOpen = false
    } catch (e: any) { alert(e.message) }
  }

  async function handleDeleteItem() {
    if (!deleteItemId) return; const tok = t(); if (!tok) return
    try {
      await fetch(`/api/menu-items/${deleteItemId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } })
      const menu = menus.find(m => m.id === activeMenuId)
      if (menu) { menu.items = menu.items.filter((i: any) => i.id !== deleteItemId); menus = [...menus] }
    } catch (e: any) { alert(e.message) } finally { deleteItemId = null }
  }
</script>

{#if mounted}
<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div><h1 class="text-2xl font-bold tracking-tight">Menus</h1><p class="text-muted-foreground">Manage navigation menus</p></div>
    <Button onclick={openCreateMenu}><Plus class="mr-2 h-4 w-4" /> New Menu</Button>
  </div>

  {#if loading}
    <p class="text-center py-8 text-muted-foreground">Loading...</p>
  {:else if menus.length === 0}
    <div class="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
      <p class="font-medium">No menus yet</p>
      <p class="text-sm">Create your first menu to get started</p>
      <Button onclick={openCreateMenu} class="mt-4"><Plus class="mr-2 h-4 w-4" /> Create Menu</Button>
    </div>
  {:else}
    <div class="grid lg:grid-cols-3 gap-6">
      <!-- Menu list sidebar -->
      <div class="space-y-2">
        <h3 class="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Menus</h3>
        {#each menus as menu (menu.id)}
          <button
            onclick={() => activeMenuId = menu.id}
            class="w-full text-left p-3 rounded-lg border transition-colors {activeMenuId === menu.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'}"
          >
            <div class="font-medium text-sm">{menu.name}</div>
            <div class="text-xs text-muted-foreground">{locationLabels[menu.location] || menu.location} · {menu.items?.length || 0} items</div>
          </button>
        {/each}
      </div>

      <!-- Active menu editor -->
      <div class="lg:col-span-2 space-y-6">
        {#if activeMenu}
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold">{activeMenu.name}</h2>
              <p class="text-sm text-muted-foreground">{locationLabels[activeMenu.location] || activeMenu.location}</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="ghost" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                  <Ellipsis class="h-4 w-4" />
                  <span class="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-40">
                <DropdownMenuItem onclick={() => openEditMenu(activeMenu)}>
                  Edit
                  <span class="ml-auto"><Pencil size={16} /></span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem class="text-red-500!" onclick={() => deleteMenuId = activeMenu.id}>
                  Delete
                  <span class="ml-auto"><Trash2 size={16} /></span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <!-- Add links section -->
          <Card>
            <CardHeader><CardTitle class="text-sm">Add Menu Items</CardTitle></CardHeader>
            <CardContent>
              <div class="space-y-4">
                <div>
                  <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Custom Link</h4>
                  <Button variant="outline" size="sm" onclick={() => openCreateItem('custom')}><Link class="h-4 w-4 mr-1" /> Add Custom Link</Button>
                </div>
                <div>
                  <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Preset Links</h4>
                  <div class="flex flex-wrap gap-2">
                    {#each presetItems as p, i}
                      <Button variant="outline" size="sm" onclick={() => openCreatePreset(p.label, p.url)}>
                        {#if i === 0}<Home class="h-4 w-4 mr-1" />{:else if i === 1}<Info class="h-4 w-4 mr-1" />{:else}<Mail class="h-4 w-4 mr-1" />{/if}
                        {p.label}
                      </Button>
                    {/each}
                  </div>
                </div>
                {#if activeMenu?.location === 'footer'}
                  <div>
                    <h4 class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Footer Presets</h4>
                    <div class="flex flex-wrap gap-2">
                      {#each footerPresetItems as p}
                        <Button variant="outline" size="sm" onclick={() => openCreatePreset(p.label, p.url)}>{p.label}</Button>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </CardContent>
          </Card>

          <!-- Menu items tree -->
          <Card>
            <CardHeader><CardTitle class="text-sm">Menu Structure</CardTitle></CardHeader>
            <CardContent>
              {#if rootItems.length === 0}
                <p class="text-sm text-muted-foreground text-center py-4">No items in this menu. Add links above.</p>
              {:else}
                <div class="space-y-1">
                  {#each rootItems as item (item.id)}
                    <div class="border rounded-lg p-3">
                      <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 min-w-0">
                          <ExternalLink class="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span class="font-medium text-sm truncate">{item.label}</span>
                          <span class="text-xs text-muted-foreground truncate">{item.url || '/'}</span>
                        </div>
                        <div class="shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button variant="ghost" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                                <Ellipsis class="h-4 w-4" />
                                <span class="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" class="w-40">
                              <DropdownMenuItem onclick={() => openEditItem(item)}>
                                Edit
                                <span class="ml-auto"><Pencil size={16} /></span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onclick={() => moveItem(item, 'up')}>
                                Move Up
                                <span class="ml-auto"><ArrowUp size={16} /></span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onclick={() => moveItem(item, 'down')}>
                                Move Down
                                <span class="ml-auto"><ArrowDown size={16} /></span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem class="text-red-500!" onclick={() => deleteItemId = item.id}>
                                Delete
                                <span class="ml-auto"><Trash2 size={16} /></span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <!-- Children -->
                      {#if getChildren(item.id).length > 0}
                        <div class="ml-6 mt-2 space-y-1 border-l-2 pl-3">
                          {#each getChildren(item.id) as child (child.id)}
                            <div class="flex items-center justify-between gap-2 py-1">
                              <div class="flex items-center gap-2 min-w-0">
                                <span class="text-muted-foreground">└</span>
                                <span class="text-sm truncate">{child.label}</span>
                                <span class="text-xs text-muted-foreground truncate">{child.url || '/'}</span>
                              </div>
                              <div class="shrink-0">
                                <DropdownMenu>
                                  <DropdownMenuTrigger>
                                    <Button variant="ghost" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                                      <Ellipsis class="h-4 w-4" />
                                      <span class="sr-only">Actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" class="w-40">
                                    <DropdownMenuItem onclick={() => openEditItem(child)}>
                                      Edit
                                      <span class="ml-auto"><Pencil size={16} /></span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onclick={() => moveItem(child, 'up')}>
                                      Move Up
                                      <span class="ml-auto"><ArrowUp size={16} /></span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onclick={() => moveItem(child, 'down')}>
                                      Move Down
                                      <span class="ml-auto"><ArrowDown size={16} /></span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem class="text-red-500!" onclick={() => deleteItemId = child.id}>
                                      Delete
                                      <span class="ml-auto"><Trash2 size={16} /></span>
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </CardContent>
          </Card>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Menu dialog -->
<Dialog open={menuDialogOpen} onOpenChange={(o) => { if (!o) menuDialogOpen = false }}>
  <DialogContent class="sm:max-w-sm"><DialogHeader><DialogTitle>{editMenu ? 'Edit' : 'New'} Menu</DialogTitle></DialogHeader>
    <div class="space-y-4 py-4">
      <div class="space-y-1"><span class="text-sm font-medium">Menu Name</span><Input bind:value={menuName} placeholder="Main Menu" aria-label="Menu Name" /></div>
      <div class="space-y-1">
        <span class="text-sm font-medium">Location</span>
        <Select type="single" bind:value={menuLocation}>
          <SelectTrigger aria-label="Location"><SelectValue /></SelectTrigger>
          <SelectContent>
            {#each Object.entries(locationLabels) as [key, label]}
              <SelectItem value={key}>{label}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </div>
    </div>
    <DialogFooter><Button variant="outline" onclick={() => menuDialogOpen = false}>Cancel</Button><Button onclick={handleSaveMenu}>Save</Button></DialogFooter>
  </DialogContent>
</Dialog>

<!-- Item dialog -->
<Dialog open={itemDialogOpen} onOpenChange={(o) => { if (!o) itemDialogOpen = false }}>
  <DialogContent class="sm:max-w-sm"><DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Menu Item</DialogTitle></DialogHeader>
    <div class="space-y-4 py-4">
      <div class="space-y-1"><span class="text-sm font-medium">Label</span><Input bind:value={itemLabel} placeholder="Menu label" aria-label="Label" /></div>
      <div class="space-y-1"><span class="text-sm font-medium">URL</span><Input bind:value={itemUrl} placeholder="https:// or /path" aria-label="URL" /></div>
      {#if rootItems.length > 0}
        <div class="space-y-1">
          <span class="text-sm font-medium">Parent Item</span>
          <Select type="single" bind:value={parentItemValue} onValueChange={(v) => itemParentId = v ? parseInt(v) : null}>
            <SelectTrigger aria-label="Parent Item"><SelectValue placeholder="None (top level)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">None (top level)</SelectItem>
              {#each rootItems as ri}
                <SelectItem value={ri.id.toString()}>{ri.label} (as submenu)</SelectItem>
              {/each}
            </SelectContent>
          </Select>
        </div>
      {/if}
    </div>
    <DialogFooter><Button variant="outline" onclick={() => itemDialogOpen = false}>Cancel</Button><Button onclick={handleSaveItem}>Save</Button></DialogFooter>
  </DialogContent>
</Dialog>

<AlertDialog open={deleteMenuId !== null} onOpenChange={(o) => { if (!o) deleteMenuId = null }}>
  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete menu?</AlertDialogTitle><AlertDialogDescription>All items will be deleted too.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onclick={handleDeleteMenu}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
</AlertDialog>

<AlertDialog open={deleteItemId !== null} onOpenChange={(o) => { if (!o) deleteItemId = null }}>
  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete item?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onclick={handleDeleteItem}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
</AlertDialog>
{:else}
  <div class="flex items-center justify-center h-24 text-muted-foreground">Loading...</div>
{/if}
