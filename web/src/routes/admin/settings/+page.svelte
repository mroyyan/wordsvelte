<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Label } from '$lib/components/ui/label'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Save, Loader2, Globe, FileText, MessageSquare, Share2, Search } from '@lucide/svelte'

  let settings = $state<Record<string, string>>({})
  let loading = $state(true)
  let saving = $state(false)
  let saved = $state(false)
  function t() { return localStorage.getItem('wordsvelte_token') }

  const sections = [
    {
      title: 'General', desc: 'Site title, tagline, and basic settings', icon: Globe,
      fields: [
        { key: 'site_name', type: 'text', label: 'Site Title', placeholder: 'My Website' },
        { key: 'site_description', type: 'textarea', label: 'Tagline', placeholder: 'A short description of your site' },
        { key: 'admin_email', type: 'email', label: 'Admin Email', placeholder: 'admin@example.com' },
        { key: 'timezone', type: 'text', label: 'Timezone', placeholder: 'Asia/Jakarta' },
        { key: 'date_format', type: 'text', label: 'Date Format', placeholder: 'd F Y' },
        { key: 'language', type: 'text', label: 'Language', placeholder: 'id' },
      ]
    },
    {
      title: 'Reading', desc: 'Post display and visibility', icon: FileText,
      fields: [
        { key: 'posts_per_page', type: 'number', label: 'Posts per page', placeholder: '20' },
        { key: 'search_engine_visible', type: 'toggle', label: 'Allow search engines', desc: 'Allow search engines to index this site' },
        { key: 'sticky_sidebar', type: 'toggle', label: 'Sticky sidebar', desc: 'Sidebar sticks to top when scrolling' },
      ]
    },
    {
      title: 'Comments', desc: 'Comment moderation and settings', icon: MessageSquare,
      fields: [
        { key: 'comments_enabled', type: 'toggle', label: 'Enable comments', desc: 'Allow visitors to leave comments' },
        { key: 'comments_auto_approve', type: 'toggle', label: 'Auto-approve', desc: 'Automatically approve all comments' },
        { key: 'comments_require_name_email', type: 'toggle', label: 'Require name & email', desc: 'Visitors must provide name and email' },
        { key: 'comments_close_after_days', type: 'number', label: 'Close after (days)', placeholder: '30' },
      ]
    },
    {
      title: 'Social', desc: 'Links displayed in footer', icon: Share2,
      fields: [
        { key: 'social_facebook', type: 'text', label: 'Facebook URL', placeholder: 'https://facebook.com/...' },
        { key: 'social_twitter', type: 'text', label: 'Twitter URL', placeholder: 'https://twitter.com/...' },
        { key: 'social_instagram', type: 'text', label: 'Instagram URL', placeholder: 'https://instagram.com/...' },
        { key: 'social_youtube', type: 'text', label: 'YouTube URL', placeholder: 'https://youtube.com/...' },
      ]
    },
    {
      title: 'Footer', desc: 'Footer content and copyright', icon: Globe,
      fields: [
        { key: 'footer_copyright_text', type: 'text', label: 'Copyright Text', placeholder: '© 2026 My Website' },
        { key: 'footer_description', type: 'textarea', label: 'Footer Description', placeholder: 'About your website...' },
      ]
    },
    {
      title: 'SEO', desc: 'Default meta tags for search engines', icon: Search,
      fields: [
        { key: 'default_meta_description', type: 'textarea', label: 'Default meta description', placeholder: 'Describe your site for search engines...' },
        { key: 'default_og_image', type: 'text', label: 'Default OG image', placeholder: 'https://example.com/image.jpg' },
      ]
    },
  ]

  onMount(async () => { const tok = t(); if (!tok) return; try { const r = await fetch(`/api/settings`, { headers: { Authorization: `Bearer ${tok}` } }); const j = await r.json(); settings = j.data ?? {} } catch {} finally { loading = false } })

  async function handleSave() {
    const tok = t(); if (!tok) return
    saving = true; saved = false
    try {
      await fetch(`/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(settings)
      })
      saved = true
      setTimeout(() => { saved = false }, 2000)
    } catch (e: any) { console.error(e) }
    finally { saving = false }
  }

  let activeTab = $state(0)
  let activeSection = $derived(sections[activeTab])
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-end justify-between gap-2">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">Settings</h2>
      <p class="text-muted-foreground">Site configuration</p>
    </div>
    <Button onclick={handleSave} disabled={saving}>
      {#if saving}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
      <Save class="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save'}
    </Button>
  </div>

  {#if loading}
    <div class="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  {:else}
    <!-- Tabs -->
    <div class="flex gap-1 border-b mb-6 overflow-x-auto">
      {#each sections as section, i}
        <button
          onclick={() => activeTab = i}
          class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors {activeTab === i ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
        >
          <svelte:component this={section.icon} class="h-4 w-4" />
          {section.title}
        </button>
      {/each}
    </div>

    <!-- Active Section -->
    <div class="max-w-2xl">
      <Card>
        <CardContent>
          <div class="space-y-4">
            {#each activeSection.fields as field}
              <div>
                {#if field.type === 'toggle'}
                  <label class="flex items-center justify-between gap-4 cursor-pointer">
                    <div>
                      <span class="text-sm font-medium">{field.label}</span>
                      {#if field.desc}
                        <p class="text-xs text-muted-foreground mt-0.5">{field.desc}</p>
                      {/if}
                    </div>
                    <Checkbox
                      checked={settings[field.key] === 'true'}
                      onCheckedChange={(v) => settings[field.key] = v ? 'true' : 'false'}
                    />
                  </label>
                {:else if field.type === 'textarea'}
                  <div class="space-y-1.5">
                    <Label for={field.key}>{field.label}</Label>
                    <Textarea
                      id={field.key}
                      bind:value={settings[field.key]}
                      placeholder={field.placeholder || ''}
                      class="min-h-[100px]"
                    />
                  </div>
                {:else}
                  <div class="space-y-1.5">
                    <Label for={field.key}>{field.label}</Label>
                    <Input
                      id={field.key}
                      type="text"
                      inputmode={field.type === 'number' ? 'numeric' : 'text'}
                      bind:value={settings[field.key]}
                      placeholder={field.placeholder || ''}
                      class={field.type === 'number' ? 'w-32' : ''}
                      oninput={field.type === 'number' ? (e) => { settings[field.key] = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '') } : undefined}
                    />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </CardContent>
      </Card>
    </div>
  {/if}
</div>
