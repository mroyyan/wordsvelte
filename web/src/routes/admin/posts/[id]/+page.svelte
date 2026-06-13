<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import MdEditor from '$lib/components/admin/md-editor.svelte'
  import { Label } from '$lib/components/ui/label'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Save, Loader2, Edit2, Check, Globe, UploadCloud, X, Plus, Link, Image } from '@lucide/svelte'
  import * as Select from '$lib/components/ui/select'
  import MediaLibrary from '$lib/components/admin/media/media-library.svelte'

  let mounted = $state(false)
  onMount(() => { mounted = true })

  let id = $derived($page.params.id)
  let title = $state('')
  let slug = $state('')
  let content = $state('')
  let excerpt = $state('')
  let status = $state('draft')
  let featuredImageUrl = $state('')
  let categoryIds = $state<number[]>([])
  let tagIds = $state<number[]>([])
  let loading = $state(true)

  let categories = $state<any[]>([])
  let tags = $state<any[]>([])
  let saving = $state(false)
  let editingSlug = $state(false)
  let slugManuallyEdited = $state(false)
  let baseUrl = $state('')
  let imageSourceType = $state('upload')
  let uploadingImage = $state(false)
  let showFeaturedMediaLibrary = $state(false)

  let visibleCategoriesCount = $state(10)
  let visibleTagsCount = $state(10)

  function t() { return localStorage.getItem('wordsvelte_token') }

  onMount(async () => {
    if (typeof window !== 'undefined') baseUrl = window.location.origin
    
    const tok = t()
    if (!tok) return

    try {
      const [catRes, tagRes, postRes] = await Promise.all([
        fetch('/api/categories', { headers: { Authorization: `Bearer ${tok}` } }),
        fetch('/api/tags', { headers: { Authorization: `Bearer ${tok}` } }),
        fetch(`/api/posts-admin/${id}`, { headers: { Authorization: `Bearer ${tok}` } })
      ])

      const [catJson, tagJson, postJson] = await Promise.all([
        catRes.json(), tagRes.json(), postRes.json()
      ])

      categories = catJson.data ?? []
      tags = tagJson.data ?? []
      
      if (postJson.success) {
        const p = postJson.data
        slugManuallyEdited = true 
        title = p.title || ''
        slug = p.slug || ''
        content = p.content || ''
        excerpt = p.excerpt || ''
        status = p.status || 'draft'
        featuredImageUrl = p.featuredImageUrl || ''
        categoryIds = p.categories?.map((c: any) => c.id) || []
        tagIds = p.tags?.map((t: any) => t.id) || []
      }
    } catch (err) {
      console.error(err)
    } finally {
      loading = false
    }
  })

  function handleCategoryScroll(e: Event) {
    const target = e.target as HTMLDivElement
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) {
      if (visibleCategoriesCount < categories.length) visibleCategoriesCount += 5
    }
  }

  function handleTagScroll(e: Event) {
    const target = e.target as HTMLDivElement
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) {
      if (visibleTagsCount < tags.length) visibleTagsCount += 5
    }
  }

  async function handleImageUpload(e: Event) {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file || !t()) return
    uploadingImage = true
    try {
      const formData = new FormData(); formData.append('file', file)
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t()}` },
        body: formData
      })
      const json = await res.json()
      if (json.success) featuredImageUrl = `/api/media/${json.data.r2Key}`
    } finally { uploadingImage = false }
  }

  async function saveAndNavigate(path: string) {
    const tok = t(); if (!tok) return
    saving = true
    try {
      await fetch(`/api/posts-admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          title, slug, content, excerpt, status, featuredImageUrl,
          categoryIds: categoryIds.length ? categoryIds : undefined,
          tagIds: tagIds.length ? tagIds : undefined,
          updatedAt: new Date().toISOString()
        })
      })
      goto(path)
    } catch {
      goto(path)
    } finally {
      saving = false
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    const tok = t(); if (!tok || saving) return
    saving = true
    try {
      const res = await fetch(`/api/posts-admin/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({
          title, slug, content, excerpt, status, featuredImageUrl,
          categoryIds: categoryIds.length ? categoryIds : undefined,
          tagIds: tagIds.length ? tagIds : undefined,
          updatedAt: new Date().toISOString()
        })
      })
      if ((await res.json()).success) goto('/admin/posts')
    } finally { saving = false }
  }

  function toggleCategory(id: number) { categoryIds = categoryIds.includes(id) ? categoryIds.filter(c => c !== id) : [...categoryIds, id] }
  function toggleTag(id: number) { tagIds = tagIds.includes(id) ? tagIds.filter(t => t !== id) : [...tagIds, id] }
</script>

{#if mounted}
<div class="flex flex-1 flex-col gap-6">
  <div class="flex flex-wrap items-end justify-between gap-2">
    <div><h2 class="text-2xl font-bold tracking-tight">Edit Post</h2><p class="text-muted-foreground">Modify your article</p></div>
    <Button type="submit" form="post-form" disabled={saving}>
      {#if saving}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
      <Save class="mr-2 h-4 w-4" /> {saving ? 'Updating...' : 'Update Post'}
    </Button>
  </div>

  {#if loading}
    <div class="flex items-center justify-center h-64 text-muted-foreground">Loading post data...</div>
  {:else}
    <form id="post-form" onsubmit={handleSubmit}>
      <div class="grid grid-cols-3 gap-6">
        <div class="col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Content</CardTitle></CardHeader>
            <CardContent class="space-y-3">
              <div class="space-y-2">
                <Label for="title">Title</Label>
                <input type="text" id="title" bind:value={title} placeholder="Post title" required class="flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-xl py-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div class="space-y-1 mt-1">
                {#if editingSlug}
                  <div class="flex items-center gap-0 px-3 py-2 bg-accent rounded-md">
                    <Globe class="h-3.5 w-3.5 text-muted-foreground mr-1" />
                    <span class="font-mono text-sm text-muted-foreground">{baseUrl}/</span>
                    <input type="text" bind:value={slug} oninput={() => slugManuallyEdited = true} class="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none font-mono text-sm text-foreground" />
                    <button type="button" onclick={() => editingSlug = false}><Check class="h-4 w-4" /></button>
                  </div>
                {:else}
                  <div class="flex items-center gap-0 group">
                    <Globe class="h-3.5 w-3.5 text-muted-foreground mr-1" />
                    <span class="font-mono text-sm text-muted-foreground">{baseUrl}/</span>
                    <span class="font-mono text-sm text-foreground">{slug}</span>
                    <button type="button" class="p-1 opacity-0 group-hover:opacity-100" onclick={() => editingSlug = true}><Edit2 class="h-4 w-4 text-muted-foreground" /></button>
                  </div>
                {/if}
              </div>
              <MdEditor bind:value={content} />
            </CardContent>
          </Card>
        </div>

        <div class="col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
            <CardContent>
              <Select.Root type="single" bind:value={status} items={[{ value: 'draft', label: 'Draft' }, { value: 'publish', label: 'Publish' }]}>
                <Select.Trigger class="w-full"><Select.Value placeholder="Select status" /></Select.Trigger>
                <Select.Content preventScroll={false}><Select.Item value="draft" label="Draft" /><Select.Item value="publish" label="Publish" /></Select.Content>
              </Select.Root>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle>Featured Image</CardTitle>
                <div class="flex rounded-md bg-muted p-0.5 text-muted-foreground">
                  <button type="button" class="rounded-sm px-2 py-1 text-xs font-medium transition-colors" class:bg-background={imageSourceType === 'upload'} class:text-foreground={imageSourceType === 'upload'} onclick={() => imageSourceType = 'upload'}>Upload</button>
                  <button type="button" class="rounded-sm px-2 py-1 text-xs font-medium transition-colors" class:bg-background={imageSourceType === 'url'} class:text-foreground={imageSourceType === 'url'} onclick={() => imageSourceType = 'url'}>URL</button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {#if imageSourceType === 'upload'}
                {#if featuredImageUrl}
                  <div class="relative group aspect-video rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                    <img src={featuredImageUrl} alt="Featured Preview" class="w-full h-full object-cover" />
                    <button type="button" class="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-background text-foreground rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" onclick={() => featuredImageUrl = ''}><X class="h-4 w-4" /></button>
                  </div>
                {:else}
                  <button type="button" class="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors" onclick={() => showFeaturedMediaLibrary = true}>
                    <div class="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud class="h-8 w-8 text-muted-foreground mb-2" />
                      <p class="text-xs text-muted-foreground"><span class="font-semibold">Browse Media</span> to choose existing</p>
                    </div>
                  </button>
                {/if}
              {:else}
                <div class="space-y-2">
                  <Label for="image">Image URL</Label>
                  <div class="relative flex items-center">
                    <Input id="image" bind:value={featuredImageUrl} placeholder="https://..." class="pr-9" />
                    {#if featuredImageUrl}<button type="button" class="absolute right-2 p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground" onclick={() => featuredImageUrl = ''}><X class="h-4 w-4" /></button>{/if}
                  </div>
                </div>
              {/if}
            </CardContent>
          </Card>

          <MediaLibrary
            bind:open={showFeaturedMediaLibrary}
            onSelect={(url: string) => {
              featuredImageUrl = url
            }}
          />

          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle>Categories</CardTitle>
                <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => saveAndNavigate('/admin/categories')}><Plus class="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="space-y-1 max-h-[220px] overflow-y-auto pr-1" onscroll={handleCategoryScroll}>
                {#each categories.slice(0, visibleCategoriesCount) as cat}
                  <label class="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-accent cursor-pointer">
                    <Checkbox checked={categoryIds.includes(cat.id)} onCheckedChange={() => toggleCategory(cat.id)} />
                    <span class="text-sm font-medium">{cat.name}</span>
                  </label>
                {/each}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle>Tags</CardTitle>
                <Button variant="ghost" size="icon" class="h-8 w-8" onclick={() => saveAndNavigate('/admin/tags')}><Plus class="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="space-y-1 max-h-[220px] overflow-y-auto pr-1" onscroll={handleTagScroll}>
                {#each tags.slice(0, visibleTagsCount) as tag}
                  <label class="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-accent cursor-pointer">
                    <Checkbox checked={tagIds.includes(tag.id)} onCheckedChange={() => toggleTag(tag.id)} />
                    <span class="text-sm font-medium">{tag.name}</span>
                  </label>
                {/each}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  {/if}
</div>
{:else}
  <div class="flex items-center justify-center h-24 text-muted-foreground">Loading...</div>
{/if}