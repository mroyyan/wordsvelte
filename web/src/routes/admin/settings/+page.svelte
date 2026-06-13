<script lang="ts">
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Save } from '@lucide/svelte'

  let settings = $state<Record<string, string>>({})
  let loading = $state(true)
  let activeTab = $state(0)
  function t() { return localStorage.getItem('wordsvelte_token') }

  const sections = [
    { title: 'General', desc: 'Site title, tagline, and basic settings', keys: ['site_name', 'site_description', 'admin_email', 'timezone', 'date_format', 'language'] },
    { title: 'Reading', desc: 'Post display and visibility', keys: ['posts_per_page', 'search_engine_visible'] },
    { title: 'Comments', desc: 'Comment moderation', keys: ['comments_enabled', 'comments_auto_approve', 'comments_require_name_email', 'comments_close_after_days'] },
    { title: 'Social', desc: 'Links displayed in footer', keys: ['social_facebook', 'social_twitter', 'social_instagram', 'social_youtube'] },
    { title: 'Footer', desc: 'Footer content and copyright', keys: ['footer_copyright_text', 'footer_description'] },
    { title: 'SEO', desc: 'Default meta tags', keys: ['default_meta_description', 'default_og_image'] },
  ]
  const labels: Record<string, string> = { site_name: 'Site Title', site_description: 'Tagline', admin_email: 'Admin Email', timezone: 'Timezone', date_format: 'Date Format', language: 'Language', posts_per_page: 'Posts per page', search_engine_visible: 'Allow search engines', comments_enabled: 'Enable comments', comments_auto_approve: 'Auto-approve', comments_require_name_email: 'Require name & email', comments_close_after_days: 'Close after (days)', social_facebook: 'Facebook URL', social_twitter: 'Twitter URL', social_instagram: 'Instagram URL', social_youtube: 'YouTube URL', footer_copyright_text: 'Copyright Text', footer_description: 'Footer Description', default_meta_description: 'Default meta description', default_og_image: 'Default OG image' }

  onMount(async () => { const tok = t(); if (!tok) return; try { const r = await fetch(`/api/settings`, { headers: { Authorization: `Bearer ${tok}` } }); const j = await r.json(); settings = j.data ?? {} } catch {} finally { loading = false } })

  async function handleSave() {
    const tok = t(); if (!tok) return
    try { await fetch(`/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(settings) }); alert('Saved!') } catch (e: any) { alert(e.message) }
  }

  let activeSection = $derived(sections[activeTab])
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div><h1 class="text-2xl font-bold tracking-tight">Settings</h1><p class="text-muted-foreground">Site configuration</p></div>
    <Button onclick={handleSave}><Save class="h-4 w-4 mr-2" /> Save</Button>
  </div>

  {#if loading}
    <p class="text-center py-8 text-muted-foreground">Loading...</p>
  {:else}
    <div class="flex gap-1 border-b mb-6">
      {#each sections as section, i}
        <button
          onclick={() => activeTab = i}
          class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === i ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}"
        >
          {section.title}
        </button>
      {/each}
    </div>

    <div class="max-w-xl">
      <div class="mb-4">
        <h2 class="text-lg font-semibold">{activeSection.title}</h2>
        <p class="text-sm text-muted-foreground">{activeSection.desc}</p>
      </div>
      <div class="space-y-4">
        {#each activeSection.keys as key}
          {#if key === 'site_description' || key === 'default_meta_description' || key === 'footer_description'}
            <div class="space-y-1"><label class="text-sm font-medium block">{labels[key] || key}<Textarea bind:value={settings[key]} class="mt-1" aria-label={labels[key] || key} /></label></div>
          {:else if key === 'search_engine_visible' || key === 'comments_enabled' || key === 'comments_auto_approve' || key === 'comments_require_name_email'}
            <div class="flex items-center gap-2"><input type="checkbox" checked={settings[key] === 'true'} onchange={(e) => settings[key] = (e.target as HTMLInputElement).checked ? 'true' : 'false'} id={key} class="rounded border-gray-300" /><label for={key} class="text-sm font-medium">{labels[key] || key}</label></div>
          {:else if key === 'posts_per_page' || key === 'comments_close_after_days'}
            <div class="space-y-1"><label class="text-sm font-medium block">{labels[key] || key}<Input type="number" bind:value={settings[key]} class="mt-1 w-32" aria-label={labels[key] || key} /></label></div>
          {:else}
            <div class="space-y-1"><label class="text-sm font-medium block">{labels[key] || key}<Input bind:value={settings[key]} class="mt-1" aria-label={labels[key] || key} /></label></div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>
