<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '$lib/components/ui/dialog'
  import { Upload, UploadCloud, FileArchive } from '@lucide/svelte'

  let mounted = $state(false)
  onMount(() => { mounted = true })

  let themes = $state<any[]>([])
  let loading = $state(true)
  let activeTheme = $state('default')
  let uploadOpen = $state(false)
  let uploadFile = $state<File | null>(null)
  let uploading = $state(false)
  let uploadError = $state('')

  function t() { return localStorage.getItem('wordsvelte_token') }

  async function load() {
    const tok = t(); if (!tok) return
    try {
      const r = await fetch('/api/themes', { headers: { Authorization: `Bearer ${tok}` } })
      const j = await r.json()
      themes = j.data ?? []
      activeTheme = themes.find((t: any) => t.active)?.slug || 'default'
    } catch {} finally { loading = false }
  }

  onMount(load)

  async function activate(slug: string) {
    const tok = t(); if (!tok) return
    try {
      await fetch(`/api/themes/${slug}`, { method: 'PUT', headers: { Authorization: `Bearer ${tok}` } })
      activeTheme = slug
      themes = themes.map((t: any) => ({ ...t, active: t.slug === slug }))
    } catch (e: any) { alert(e.message) }
  }

  async function handleUpload() {
    if (!uploadFile) return
    const tok = t(); if (!tok) return
    uploading = true
    uploadError = ''
    try {
      const form = new FormData()
      form.append('file', uploadFile)
      const r = await fetch('/api/themes/upload', { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: form })
      const j = await r.json()
      if (!j.success) { uploadError = j.error; return }
      uploadOpen = false
      uploadFile = null
      await load()
    } catch (e: any) { uploadError = e.message }
    finally { uploading = false }
  }
</script>

{#if mounted}
<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div><h1 class="text-2xl font-bold tracking-tight">Themes</h1><p class="text-muted-foreground">Manage site appearance</p></div>
    <Button onclick={() => uploadOpen = true}><Upload class="h-4 w-4 mr-2" /> Upload Theme</Button>
  </div>

  {#if loading}
    <p class="text-center py-8 text-muted-foreground">Loading...</p>
  {:else if themes.length === 0}
    <div class="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
      <UploadCloud class="h-8 w-8 mx-auto mb-3" />
      <p class="font-medium">No themes yet</p>
      <p class="text-sm mb-4">Upload a .zip theme file</p>
      <Button onclick={() => uploadOpen = true}><Upload class="h-4 w-4 mr-2" /> Upload Theme</Button>
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {#each themes as theme (theme.slug)}
        <div class="rounded-lg border border-gray-200 bg-card text-card-foreground p-3 hover:border-gray-400 transition-all">
          <div class="aspect-[16/9] bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs font-medium mb-2">
            <div class="text-center p-6">
              <FileArchive class="h-10 w-10 mx-auto mb-3 opacity-30" />
              <span class="block truncate max-w-28 text-muted-foreground/60">{theme.name}</span>
            </div>
          </div>
          <div class="space-y-1.5">
            <div class="flex items-start justify-between gap-1">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium leading-tight truncate">{theme.name}</p>

              </div>
              <span class="shrink-0 text-[11px] text-muted-foreground">{theme.version || '1.0'}</span>
            </div>
            <p class="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{theme.description || 'No description'}</p>
            {#if theme.slug === activeTheme}
              <Button size="sm" class="w-full h-7 text-xs" variant="secondary" disabled>Active</Button>
            {:else}
              <Button size="sm" class="w-full h-7 text-xs" onclick={() => activate(theme.slug)}>Activate</Button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<Dialog open={uploadOpen} onOpenChange={(o) => { if (!o) { uploadOpen = false; uploadFile = null; uploadError = '' } }}>
  <DialogContent class="sm:max-w-sm"><DialogHeader><DialogTitle>Upload Theme</DialogTitle></DialogHeader>
    <div class="space-y-4 py-4">
      <button type="button" class="border-2 border-dashed rounded-lg p-8 text-center w-full cursor-pointer hover:bg-muted/50 transition-colors" onclick={() => document.getElementById('theme-file-input')?.click()}>
        <UploadCloud class="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p class="text-sm font-medium">{uploadFile ? uploadFile.name : 'Click to select .zip file'}</p>
        <p class="text-xs text-muted-foreground mt-1">Theme must contain manifest.json</p>
        <Input id="theme-file-input" type="file" accept=".zip" class="hidden" onchange={(e) => { const files = (e.target as HTMLInputElement).files; if (files?.length) uploadFile = files[0] }} />
      </button>
      {#if uploadError}
        <p class="text-sm text-destructive">{uploadError}</p>
      {/if}
    </div>
    <DialogFooter>
      <Button variant="outline" onclick={() => { uploadOpen = false; uploadFile = null; uploadError = '' }}>Cancel</Button>
      <Button disabled={!uploadFile || uploading} onclick={handleUpload}>{uploading ? 'Uploading...' : 'Upload & Install'}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
{:else}
  <div class="flex items-center justify-center h-24 text-muted-foreground">Loading...</div>
{/if}
