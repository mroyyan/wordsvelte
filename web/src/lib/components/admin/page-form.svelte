<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import SaveIcon from '@lucide/svelte/icons/save'
  import GlobeIcon from '@lucide/svelte/icons/globe'
  import CheckIcon from '@lucide/svelte/icons/check'
  import Edit2Icon from '@lucide/svelte/icons/pencil'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import { toSlug } from '@wordsvelte/shared'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import * as Select from '$lib/components/ui/select'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import MdEditor from '$lib/components/admin/md-editor.svelte'

  interface PageRecord { id: number; title: string; slug: string; content: string; status: 'draft' | 'publish' }

  let { page = null }: { page?: PageRecord | null } = $props()

  let mounted = $state(false)
  let baseUrl = $state('')
  onMount(() => { mounted = true; baseUrl = window.location.origin })

  // svelte-ignore state_referenced_locally
  let title = $state(page?.title ?? '')
  // svelte-ignore state_referenced_locally
  let slug = $state(page?.slug ?? '')
  // svelte-ignore state_referenced_locally
  let content = $state(page?.content ?? '')
  // svelte-ignore state_referenced_locally
  let status = $state<'draft' | 'publish'>(page?.status ?? 'draft')
  // The address follows the title until it is edited by hand (or the page already has one).
  // svelte-ignore state_referenced_locally
  let slugManuallyEdited = $state(!!page)
  let editingSlug = $state(false)
  let saving = $state(false)
  let error = $state('')

  const token = () => localStorage.getItem('wordsvelte_token')

  function onTitleInput() {
    if (!slugManuallyEdited) slug = toSlug(title)
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!title.trim()) { error = 'Title is required'; return }
    saving = true; error = ''
    try {
      const res = await fetch(page ? `/api/pages/${page.id}` : '/api/pages', {
        method: page ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ title, slug: slug || undefined, content, status }),
      })
      const json = await res.json()
      if (!json.success) { error = json.error || 'Could not save the page'; return }
      toast.success(page ? 'Page updated' : 'Page created')
      if (!page) await goto(`/admin/pages/${json.data.id}`)
      else { slug = json.data.slug; title = json.data.title }
    } catch (err: any) { error = err.message } finally { saving = false }
  }
</script>

{#if mounted}
<div class="flex flex-1 flex-col gap-6">
  <div class="flex flex-wrap items-end justify-between gap-2">
    <div>
      <h2 class="text-xl font-bold tracking-tight sm:text-2xl">{page ? 'Edit Page' : 'New Page'}</h2>
      <p class="text-sm text-muted-foreground sm:text-base">{page ? 'Update this static page' : 'Create a static page such as About or Contact'}</p>
    </div>
    <div class="flex items-center gap-2">
      {#if page && page.status === 'publish'}
        <Button variant="outline" onclick={() => window.open(`/${page.slug}`, '_blank')}>
          <ExternalLinkIcon class="mr-2 h-4 w-4" /> View
        </Button>
      {/if}
      <Button type="submit" form="page-form" disabled={saving}>
        {#if saving}<Loader2Icon class="mr-2 h-4 w-4 animate-spin" />{/if}
        <SaveIcon class="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Page'}
      </Button>
    </div>
  </div>

  <form id="page-form" onsubmit={handleSubmit}>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="min-w-0 space-y-6 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Content</CardTitle></CardHeader>
          <CardContent class="space-y-3">
            <div class="space-y-2">
              <Label for="page-title">Title</Label>
              <input
                type="text"
                id="page-title"
                bind:value={title}
                oninput={onTitleInput}
                placeholder="Page title"
                required
                class="flex h-12 w-full rounded-md border border-input bg-transparent px-3 text-xl py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div class="space-y-1 mt-1">
              {#if editingSlug}
                <div class="flex items-center gap-0 px-3 py-2 bg-accent rounded-md">
                  <GlobeIcon class="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  <span class="font-mono text-sm text-muted-foreground">{baseUrl}/</span>
                  <input
                    type="text"
                    bind:value={slug}
                    oninput={() => { slugManuallyEdited = true }}
                    placeholder="auto-generated"
                    class="flex-1 bg-transparent border-0 focus:ring-0 focus:outline-none font-mono text-sm text-foreground"
                    aria-label="Edit slug"
                  />
                  <button type="button" class="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground" onclick={() => { editingSlug = false }} aria-label="Done editing slug">
                    <CheckIcon class="h-4 w-4" />
                  </button>
                </div>
              {:else}
                <div class="flex items-center gap-0 group">
                  <GlobeIcon class="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  <span class="font-mono text-sm text-muted-foreground">{baseUrl}/</span>
                  <span class="font-mono text-sm text-foreground">{slug || 'auto-generated'}</span>
                  <button type="button" class="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity" onclick={() => { editingSlug = true }} aria-label="Edit slug">
                    <Edit2Icon class="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              {/if}
            </div>

            <div class="space-y-2">
              <Label for="page-content">Content</Label>
              <MdEditor bind:value={content} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div class="min-w-0 space-y-6 lg:col-span-1">
        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent class="space-y-3">
            <Select.Root type="single" bind:value={status} items={[{ value: 'draft', label: 'Draft' }, { value: 'publish', label: 'Publish' }]}>
              <Select.Trigger class="w-full">
                <Select.Value placeholder="Select status" />
              </Select.Trigger>
              <Select.Content preventScroll={false}>
                <Select.Item value="draft" label="Draft" />
                <Select.Item value="publish" label="Publish" />
              </Select.Content>
            </Select.Root>
            <p class="text-xs text-muted-foreground">
              Slugs are shared with posts, so an address can only be used once. Add the page to a menu under Appearance &gt; Menus.
            </p>
          </CardContent>
        </Card>

        {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}
      </div>
    </div>
  </form>
</div>
{:else}
  <div class="flex flex-1 flex-col gap-4"><div class="flex items-center justify-center h-24 text-muted-foreground">Loading...</div></div>
{/if}
