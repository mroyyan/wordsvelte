<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '$lib/components/ui/select'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '$lib/components/ui/dialog'
  import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '$lib/components/ui/alert-dialog'
  import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
  } from '$lib/components/ui/dropdown-menu'
  import { Plus } from '@lucide/svelte'
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import EyeOff from '@lucide/svelte/icons/eye-off'
  import Eye from '@lucide/svelte/icons/eye'
  import Pencil from '@lucide/svelte/icons/pencil'
  import Trash2 from '@lucide/svelte/icons/trash-2'


  let mounted = $state(false)
  onMount(() => { mounted = true })

  let widgets = $state<any[]>([])
  let loading = $state(true)
  let dialogOpen = $state(false)
  let editItem = $state<any | null>(null)
  let deleteId = $state<number | null>(null)
  let activeTab = $state('sidebar-1')

  let formType = $state('html')
  let formTitle = $state('')
  let formContent = $state('')
  let formArea = $state('sidebar-1')
  let formSettings = $state('')

  const widgetTypes = [
    { value: 'html', label: 'Custom HTML' },
    { value: 'popular_posts', label: 'Popular Posts' },
    { value: 'recent_posts', label: 'Recent Posts' },
    { value: 'tag_cloud', label: 'Tag Cloud' },
    { value: 'categories', label: 'Categories' },
  ]

  const areaLabels: Record<string, string> = {
    'sidebar-1': 'Sidebar',
    'header': 'Header',
    'footer-1': 'Footer Kiri',
    'footer-2': 'Footer Tengah',
    'footer-3': 'Footer Kanan',
  }

  function t() { return localStorage.getItem('wordsvelte_token') }

  async function load() {
    const tok = t(); if (!tok) return
    try {
      const r = await fetch('/api/widgets', { headers: { Authorization: `Bearer ${tok}` } })
      const j = await r.json()
      widgets = j.data ?? []
    } catch {} finally { loading = false }
  }

  onMount(load)

  let areaWidgets = $derived(widgets.filter((w: any) => w.sidebarArea === activeTab))
  let usedTypes = $derived(new Set(areaWidgets.filter((w: any) => w.status === 'active').map((w: any) => w.widgetType)))
  let inactiveWidgets = $derived(widgets.filter((w: any) => w.status === 'inactive'))

  let areas = $derived([...new Set(widgets.map((w: any) => w.sidebarArea))])

  function openCreate() {
    editItem = null
    formType = 'html'
    formTitle = ''
    formContent = ''
    formArea = activeTab
    formSettings = ''
    dialogOpen = true
  }

  function openEdit(w: any) {
    editItem = w
    formType = w.widgetType
    formTitle = w.title || ''
    formContent = w.content || ''
    formArea = w.sidebarArea
    formSettings = w.settings || ''
    dialogOpen = true
  }

  async function handleSave() {
    const tok = t(); if (!tok) return
    try {
      const body: any = {
        widgetType: formType,
        title: formTitle || null,
        content: formType === 'html' ? formContent : null,
        sidebarArea: formArea,
        settings: formSettings || null,
      }
      if (editItem) {
        const r = await fetch(`/api/widgets/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) })
        const j = await r.json()
        if (j.data) widgets = widgets.map((w: any) => w.id === editItem.id ? j.data : w)
      } else {
        const r = await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ ...body, sortOrder: widgets.length }) })
        const j = await r.json()
        if (j.data) widgets = [...widgets, j.data]
      }
      dialogOpen = false
    } catch (e: any) { alert(e.message) }
  }

  async function handleDelete() {
    if (!deleteId) return; const tok = t(); if (!tok) return
    try { await fetch(`/api/widgets/${deleteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }); widgets = widgets.filter((w: any) => w.id !== deleteId) } catch (e: any) { alert(e.message) } finally { deleteId = null }
  }

  function getWidgetLabel(type: string) {
    return widgetTypes.find(w => w.value === type)?.label || type
  }

  async function toggleStatus(w: any) {
    const tok = t(); if (!tok) return
    const newStatus = w.status === 'active' ? 'inactive' : 'active'
    try {
      const r = await fetch(`/api/widgets/${w.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ status: newStatus }) })
      const j = await r.json()
      if (j.data) widgets = widgets.map((x: any) => x.id === w.id ? j.data : x)
    } catch (e: any) { alert(e.message) }
  }

  async function moveUp(w: any, idx: number) {
    if (idx === 0) return
    const tok = t(); if (!tok) return
    const prev = areaWidgets[idx - 1]
    await Promise.all([
      fetch(`/api/widgets/${w.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ sortOrder: prev.sortOrder }) }),
      fetch(`/api/widgets/${prev.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ sortOrder: w.sortOrder }) }),
    ])
    load()
  }

  async function moveDown(w: any, idx: number) {
    if (idx >= areaWidgets.length - 1) return
    const tok = t(); if (!tok) return
    const next = areaWidgets[idx + 1]
    await Promise.all([
      fetch(`/api/widgets/${w.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ sortOrder: next.sortOrder }) }),
      fetch(`/api/widgets/${next.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ sortOrder: w.sortOrder }) }),
    ])
    load()
  }
</script>

{#if mounted}
<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div><h1 class="text-2xl font-bold tracking-tight">Widgets</h1><p class="text-muted-foreground">Manage sidebar widgets</p></div>
    <Button onclick={openCreate}><Plus class="mr-2 h-4 w-4" /> Add Widget</Button>
  </div>

  {#if loading}
    <p class="text-center py-8 text-muted-foreground">Loading...</p>
  {:else}
    <!-- Area tabs -->
    <div class="flex gap-1 border-b mb-6">
      {#each ['sidebar-1', 'header', 'footer-1', 'footer-2', 'footer-3'] as area}
        <button
          onclick={() => activeTab = area}
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === area ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
        >
          {areaLabels[area]}
        </button>
      {/each}
    </div>



    <div class="grid lg:grid-cols-3 gap-6">
      <!-- Active widgets in selected area -->
      <div class="lg:col-span-2 space-y-3">
        <h3 class="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Active Widgets — {areaLabels[activeTab]}</h3>
        {#if areaWidgets.filter(w => w.status === 'active').length === 0}
          <div class="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
            <p>No widgets in this area</p>
            <p class="text-sm">Click "Add Widget" to add one</p>
          </div>
        {:else}
          {#each areaWidgets.filter(w => w.status === 'active') as w, i (w.id)}
            <Card>
              <div class="px-4">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <span class="font-medium">{w.title || getWidgetLabel(w.widgetType)}</span>
                      <span class="text-xs text-muted-foreground ml-2">({getWidgetLabel(w.widgetType)})</span>
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
                          <DropdownMenuItem onclick={() => toggleStatus(w)}>
                            {w.status === 'active' ? 'Deactivate' : 'Activate'}
                            <span class="ml-auto">{#if w.status === 'active'}<EyeOff size={16} />{:else}<Eye size={16} />{/if}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onclick={() => openEdit(w)}>
                            Edit
                            <span class="ml-auto"><Pencil size={16} /></span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem class="text-red-500!" onclick={() => deleteId = w.id}>
                            Delete
                            <span class="ml-auto"><Trash2 size={16} /></span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {#if i > 0}
                    <button onclick={() => moveUp(w, i)} class="text-xs text-muted-foreground hover:text-foreground mr-2">↑ Move up</button>
                  {/if}
                  {#if i < areaWidgets.filter(x => x.status === 'active').length - 1}
                    <button onclick={() => moveDown(w, i)} class="text-xs text-muted-foreground hover:text-foreground">↓ Move down</button>
                  {/if}
                </div>
              </div>
            </Card>
          {/each}
        {/if}

        <!-- Inactive widgets -->
        {#if inactiveWidgets.length > 0}
          <h3 class="font-semibold text-sm text-muted-foreground uppercase tracking-wider mt-8">Inactive Widgets</h3>
          <div class="space-y-2">
            {#each inactiveWidgets as w (w.id)}
              <Card>
                <div class="flex items-center gap-3 p-3">
                  <div class="flex-1 min-w-0">
                    <span class="font-medium">{w.title || getWidgetLabel(w.widgetType)}</span>
                    <span class="text-xs text-muted-foreground ml-2">({getWidgetLabel(w.widgetType)})</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <Button variant="ghost" class="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                        <Ellipsis class="h-4 w-4" />
                        <span class="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" class="w-40">
                      <DropdownMenuItem onclick={() => toggleStatus(w)}>
                        Activate
                        <span class="ml-auto"><Eye size={16} /></span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onclick={() => { editItem = w; openEdit(w) }}>
                        Edit
                        <span class="ml-auto"><Pencil size={16} /></span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem class="text-red-500!" onclick={() => deleteId = w.id}>
                        Delete
                        <span class="ml-auto"><Trash2 size={16} /></span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Presets — hide individual buttons once that widget type is used -->
      <div class="lg:col-span-1 space-y-3">
        <Card>
          <CardHeader><CardTitle class="text-sm">Quick Add</CardTitle></CardHeader>
          <CardContent class="space-y-2">
            {#if activeTab === 'sidebar-1'}
              {#if !usedTypes.has('popular_posts')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'popular_posts', title: 'Berita Populer', settings: '{"limit":5}', sidebarArea: activeTab }) }); load() }}>+ Berita Populer</Button>{/if}
              {#if !usedTypes.has('recent_posts')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'recent_posts', title: 'Berita Terbaru', settings: '{"limit":5}', sidebarArea: activeTab }) }); load() }}>+ Berita Terbaru</Button>{/if}
              {#if !usedTypes.has('categories')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'categories', title: 'Kategori', sidebarArea: activeTab }) }); load() }}>+ Kategori</Button>{/if}
              {#if !usedTypes.has('tag_cloud')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'tag_cloud', title: 'Tag', sidebarArea: activeTab }) }); load() }}>+ Tag Cloud</Button>{/if}
              {#if !usedTypes.has('html')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'html', title: 'Custom HTML', content: '', sidebarArea: activeTab }) }); load() }}>+ Custom HTML</Button>{/if}
            {:else if activeTab === 'header'}
              <p class="text-xs text-muted-foreground">Header widgets appear above the main content.</p>
              {#if !usedTypes.has('html')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'html', title: 'Header Banner', content: '<div class=&quot;bg-blue-100 p-4 text-center&quot;>Header Banner</div>', sidebarArea: activeTab }) }); load() }}>+ Header Banner</Button>{/if}
            {:else if activeTab.startsWith('footer-')}
              {#if !usedTypes.has('html')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'html', title: 'Tentang Kami', content: '<p class=&quot;text-sm&quot;>WordSvelte adalah sebuah blog yang dibuat dengan SvelteKit.</p>', sidebarArea: activeTab }) }); load() }}>+ Tentang Kami</Button>{/if}
              {#if !usedTypes.has('categories')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'categories', title: 'Kategori', sidebarArea: activeTab }) }); load() }}>+ Kategori</Button>{/if}
              {#if !usedTypes.has('tag_cloud')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'tag_cloud', title: 'Tag', sidebarArea: activeTab }) }); load() }}>+ Tag Cloud</Button>{/if}
              {#if !usedTypes.has('popular_posts')}<Button size="sm" variant="outline" class="w-full justify-start text-xs h-8" onclick={async () => { const tok = t(); if (!tok) return; await fetch('/api/widgets', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ widgetType: 'popular_posts', title: 'Berita Populer', settings: '{"limit":3}', sidebarArea: activeTab }) }); load() }}>+ Berita Populer</Button>{/if}
            {/if}
          </CardContent>
        </Card>
      </div>
    </div>
  {/if}
</div>

<Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) dialogOpen = false }}>
  <DialogContent class="sm:max-w-lg">
    <DialogHeader><DialogTitle>{editItem ? 'Edit' : 'Add'} Widget</DialogTitle></DialogHeader>
    <div class="space-y-4 py-4">
      <div class="space-y-1">
        <span class="text-sm font-medium">Widget Type</span>
        <Select type="single" bind:value={formType}>
          <SelectTrigger aria-label="Widget Type"><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {#each widgetTypes as wt}
              <SelectItem value={wt.value}>{wt.label}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1">
        <span class="text-sm font-medium">Title</span>
        <Input bind:value={formTitle} placeholder="Widget title" aria-label="Title" />
      </div>
      <div class="space-y-1">
        <span class="text-sm font-medium">Area</span>
        <Select type="single" bind:value={formArea}>
          <SelectTrigger aria-label="Area"><SelectValue placeholder="Select area" /></SelectTrigger>
          <SelectContent>
            {#each Object.entries(areaLabels) as [key, label]}
              <SelectItem value={key}>{label}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </div>
      {#if formType === 'html'}
        <div class="space-y-1">
          <span class="text-sm font-medium">HTML Content</span>
          <Textarea bind:value={formContent} placeholder={'<div>Your HTML here</div>'} class="min-h-32 font-mono text-xs" aria-label="HTML Content" />
        </div>
      {:else if formType === 'popular_posts' || formType === 'recent_posts'}
        <div class="space-y-1">
          <span class="text-sm font-medium">Settings (JSON)</span>
          <Textarea bind:value={formSettings} placeholder={'{"limit": 5}'} class="min-h-20 font-mono text-xs" aria-label="Settings (JSON)" />
          <p class="text-xs text-muted-foreground">Configure {'{"limit": 5}'} to set number of posts</p>
        </div>
      {:else if formType === 'tag_cloud' || formType === 'categories'}
        <div class="space-y-1">
          <span class="text-sm font-medium">Settings (JSON)</span>
          <Textarea bind:value={formSettings} placeholder={'{"limit": 10}'} class="min-h-20 font-mono text-xs" aria-label="Settings (JSON)" />
        </div>
      {/if}
    </div>
    <DialogFooter>
      <Button variant="outline" onclick={() => dialogOpen = false}>Cancel</Button>
      <Button onclick={handleSave}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) deleteId = null }}>
  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete widget?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onclick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
</AlertDialog>
{:else}
  <div class="flex items-center justify-center h-24 text-muted-foreground">Loading...</div>
{/if}
