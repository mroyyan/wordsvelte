<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Upload, FileText, FolderTree, Tags, ImageIcon, MessageSquare, Loader2, CheckCircle2, AlertCircle, ArrowRight } from '@lucide/svelte'

  type Stage = 'upload' | 'preview' | 'importing' | 'done' | 'error'

  let stage = $state<Stage>('upload')
  let file = $state<File | null>(null)
  let uploading = $state(false)
  let preview = $state<any>(null)
  let progress = $state<any>(null)
  let results = $state<any>(null)
  let error = $state('')
  let activeTab = $state('wordpress')

  function t() { return localStorage.getItem('wordsvelte_token') }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    file = input.files?.[0] || null
  }

  async function handlePreview() {
    if (!file) return
    const tok = t(); if (!tok) return
    uploading = true
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await fetch('/api/migrate/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
        body: fd,
      })
      const j = await r.json()
      if (j.success) {
        preview = j.data
        stage = 'preview'
      } else {
        error = j.error || 'Preview failed'
        stage = 'error'
      }
    } catch (e: any) {
      error = e.message
      stage = 'error'
    } finally {
      uploading = false
    }
  }

  async function handleImport() {
    if (!file) return
    const tok = t(); if (!tok) return
    stage = 'importing'
    const fd = new FormData()
    fd.append('file', file)

    try {
      const r = await fetch('/api/migrate/import', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tok}` },
        body: fd,
      })

      if (!r.ok) {
        const j = await r.json()
        error = j.error || 'Import failed'
        stage = 'error'
        return
      }

      const reader = r.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.stage === 'done') {
                results = data
                stage = 'done'
              } else if (data.stage === 'error') {
                error = data.message
                stage = 'error'
              } else {
                progress = data
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      error = e.message
      stage = 'error'
    }
  }

  function reset() {
    stage = 'upload'
    file = null
    preview = null
    progress = null
    results = null
    error = ''
  }

  const stats = $derived([
    { label: 'Posts', value: preview?.posts || 0, icon: FileText },
    { label: 'Categories', value: preview?.categories || 0, icon: FolderTree },
    { label: 'Tags', value: preview?.tags || 0, icon: Tags },
    { label: 'Images', value: preview?.images || 0, icon: ImageIcon },
    { label: 'Comments', value: preview?.comments || 0, icon: MessageSquare },
  ])

  const progressPercent = $derived(() => {
    if (!progress || !preview) return 0
    const weights: Record<string, number> = { categories: 0.05, tags: 0.05, images: 0.3, posts: 0.45, comments: 0.15 }
    const stageWeight = weights[progress.stage] || 0
    const withinStage = progress.total > 0 ? progress.current / progress.total : 0
    let priorWeight = 0
    const stageOrder = ['categories', 'tags', 'images', 'posts', 'comments']
    for (const s of stageOrder) {
      if (s === progress.stage) break
      priorWeight += weights[s] || 0
    }
    return Math.round((priorWeight + stageWeight * withinStage) * 100)
  })
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Migration</h1>
      <p class="text-muted-foreground">Import content from other platforms</p>
    </div>
  </div>

  <!-- Tab bar -->
  <div class="flex gap-1 border-b">
    <button
      onclick={() => activeTab = 'wordpress'}
      class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'wordpress' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
    >
      WordPress
    </button>
  </div>

  {#if activeTab === 'wordpress'}
    <div class="grid lg:grid-cols-3 gap-6">
      <!-- Main content -->
      <div class="lg:col-span-2 space-y-4">
        {#if stage === 'upload'}
          <Card>
            <CardHeader>
              <CardTitle>Upload WXR File</CardTitle>
              <CardDescription>
                Export your WordPress content via Tools → Export → "All content". The downloaded .xml file is what you need.
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="relative border-2 border-dashed rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
                <Upload class="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p class="text-sm text-muted-foreground mb-3">
                  {file ? file.name : 'Click to select WXR file'}
                </p>
                <input
                  type="file"
                  accept=".xml,.wxr"
                  onchange={handleFileSelect}
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {#if !file}
                  <p class="text-xs text-muted-foreground">Supports .xml and .wxr files up to 100MB</p>
                {/if}
              </div>

              {#if file}
                <div class="flex items-center justify-between">
                  <div class="text-sm">
                    <span class="font-medium">{file.name}</span>
                    <span class="text-muted-foreground ml-2">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                  <Button onclick={handlePreview} disabled={uploading}>
                    {#if uploading}
                      <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                      Parsing...
                    {:else}
                      Preview Import
                      <ArrowRight class="ml-2 h-4 w-4" />
                    {/if}
                  </Button>
                </div>
              {/if}
            </CardContent>
          </Card>

        {:else if stage === 'preview'}
          <Card>
            <CardHeader>
              <CardTitle>Import Preview</CardTitle>
              <CardDescription>Review what will be imported from "{file?.name}"</CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <div class="grid grid-cols-5 gap-3">
                {#each stats as stat}
                  <div class="text-center p-3 rounded-lg bg-muted/50">
                    <stat.icon class="mx-auto h-5 w-5 text-muted-foreground mb-1" />
                    <div class="text-2xl font-bold">{stat.value}</div>
                    <div class="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                {/each}
              </div>

              <div class="flex justify-end gap-2">
                <Button variant="outline" onclick={reset}>Cancel</Button>
                <Button onclick={handleImport}>
                  Start Import
                  <ArrowRight class="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

        {:else if stage === 'importing'}
          <Card>
            <CardHeader>
              <CardTitle>Importing...</CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="w-full bg-muted rounded-full h-3">
                <div
                  class="bg-primary h-3 rounded-full transition-all duration-300"
                  style="width: {progressPercent()}%"
                ></div>
              </div>

              {#if progress}
                <div class="flex items-center gap-2 text-sm">
                  <Loader2 class="h-4 w-4 animate-spin text-primary" />
                  <span class="text-muted-foreground">{progress.stage}:</span>
                  <span class="font-medium">{progress.message}</span>
                  <span class="text-muted-foreground ml-auto">{progress.current}/{progress.total}</span>
                </div>
              {/if}
            </CardContent>
          </Card>

        {:else if stage === 'done'}
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <CheckCircle2 class="h-6 w-6 text-muted-foreground" />
                Import Complete
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="grid grid-cols-5 gap-3">
                <div class="text-center p-3 rounded-lg bg-muted/50">
                  <div class="text-2xl font-bold">{results?.totalPosts || 0}</div>
                  <div class="text-xs text-muted-foreground">Posts</div>
                </div>
                <div class="text-center p-3 rounded-lg bg-muted/50">
                  <div class="text-2xl font-bold">{results?.totalCategories || 0}</div>
                  <div class="text-xs text-muted-foreground">Categories</div>
                </div>
                <div class="text-center p-3 rounded-lg bg-muted/50">
                  <div class="text-2xl font-bold">{results?.totalTags || 0}</div>
                  <div class="text-xs text-muted-foreground">Tags</div>
                </div>
                <div class="text-center p-3 rounded-lg bg-muted/50">
                  <div class="text-2xl font-bold">{results?.totalImages || 0}</div>
                  <div class="text-xs text-muted-foreground">Images</div>
                </div>
                <div class="text-center p-3 rounded-lg bg-muted/50">
                  <div class="text-2xl font-bold">{results?.totalComments || 0}</div>
                  <div class="text-xs text-muted-foreground">Comments</div>
                </div>
              </div>

              {#if results?.errors > 0}
                <div class="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
                  <AlertCircle class="h-4 w-4" />
                  {results.errors} error(s) occurred during import
                </div>
              {/if}

              <div class="flex justify-end gap-2">
                <Button variant="outline" onclick={reset}>Import Another</Button>
                <Button onclick={() => window.location.href = '/admin/posts'}>View Posts</Button>
              </div>
            </CardContent>
          </Card>

        {:else if stage === 'error'}
          <Card>
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <AlertCircle class="h-6 w-6 text-red-500" />
                Import Failed
              </CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
              <div class="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4">
                {error}
              </div>
              <div class="flex justify-end">
                <Button variant="outline" onclick={reset}>Try Again</Button>
              </div>
            </CardContent>
          </Card>
        {/if}
      </div>

      <!-- Sidebar -->
      <div class="lg:col-span-1 space-y-3">
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">How it works</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm text-muted-foreground">
            <div class="flex gap-3">
              <span class="font-medium shrink-0">1</span>
              <p>Go to WordPress admin → Tools → Export → Select "All content" → Download</p>
            </div>
            <div class="flex gap-3">
              <span class="font-medium shrink-0">2</span>
              <p>Upload the .xml file using the form on the left</p>
            </div>
            <div class="flex gap-3">
              <span class="font-medium shrink-0">3</span>
              <p>Preview the data before importing</p>
            </div>
            <div class="flex gap-3">
              <span class="font-medium shrink-0">4</span>
              <p>Click "Start Import" and wait for the process to complete</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-sm">What gets imported</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2 text-sm text-muted-foreground">
            <div class="flex items-center gap-2">
              <FileText class="h-4 w-4 text-muted-foreground" />
              <span>Posts with original slugs preserved</span>
            </div>
            <div class="flex items-center gap-2">
              <FolderTree class="h-4 w-4 text-muted-foreground" />
              <span>Categories (flat structure)</span>
            </div>
            <div class="flex items-center gap-2">
              <Tags class="h-4 w-4 text-muted-foreground" />
              <span>Tags</span>
            </div>
            <div class="flex items-center gap-2">
              <ImageIcon class="h-4 w-4 text-muted-foreground" />
              <span>Images (downloaded & hosted locally)</span>
            </div>
            <div class="flex items-center gap-2">
              <MessageSquare class="h-4 w-4 text-muted-foreground" />
              <span>Comments with nested replies</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  {/if}
</div>
