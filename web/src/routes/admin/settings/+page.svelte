<script lang="ts">
  import { onMount } from 'svelte'
  import { PUBLIC_API_URL } from '$env/static/public'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import { Save } from 'lucide-svelte'

  let settings = $state<Record<string, string>>({})
  let loading = $state(true)
  function t() { return localStorage.getItem('kubus_token') }

  const sections = [
    { title: 'General', desc: 'Site title, tagline, and basic settings', keys: ['site_name', 'site_description', 'admin_email', 'timezone', 'date_format', 'language'] },
    { title: 'Content / Reading', desc: 'Post display and visibility', keys: ['posts_per_page', 'search_engine_visible'] },
    { title: 'Comments / Discussion', desc: 'Comment moderation', keys: ['comments_enabled', 'comments_auto_approve', 'comments_require_name_email', 'comments_close_after_days'] },
    { title: 'Social Media', desc: 'Links displayed in footer', keys: ['social_facebook', 'social_twitter', 'social_instagram', 'social_youtube'] },
    { title: 'SEO', desc: 'Default meta tags', keys: ['default_meta_description', 'default_og_image'] },
  ]
  const labels: Record<string, string> = { site_name: 'Site Title', site_description: 'Tagline', admin_email: 'Admin Email', timezone: 'Timezone', date_format: 'Date Format', language: 'Language', posts_per_page: 'Posts per page', search_engine_visible: 'Allow search engines', comments_enabled: 'Enable comments', comments_auto_approve: 'Auto-approve', comments_require_name_email: 'Require name & email', comments_close_after_days: 'Close after (days)', social_facebook: 'Facebook URL', social_twitter: 'Twitter URL', social_instagram: 'Instagram URL', social_youtube: 'YouTube URL', default_meta_description: 'Default meta description', default_og_image: 'Default OG image' }

  onMount(async () => { const tok = t(); if (!tok) return; try { const r = await fetch(`/api/settings`, { headers: { Authorization: `Bearer ${tok}` } }); const j = await r.json(); settings = j.data ?? {} } catch {} finally { loading = false } })

  async function handleSave() {
    const tok = t(); if (!tok) return
    try { await fetch(`/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(settings) }); alert('Saved!') } catch (e: any) { alert(e.message) }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <div><h1 class="text-2xl font-bold tracking-tight">Settings</h1><p class="text-muted-foreground">Site configuration</p></div>
    <Button onclick={handleSave}><Save class="h-4 w-4 mr-2" /> Save</Button>
  </div>
  {#if loading}
    <p class="text-center py-8 text-muted-foreground">Loading...</p>
  {:else}
    <div class="grid gap-6 max-w-2xl">
      {#each sections as section}
        <Card>
          <CardHeader><CardTitle class="text-lg">{section.title}</CardTitle><CardDescription>{section.desc}</CardDescription></CardHeader>
          <CardContent class="space-y-4">
            {#each section.keys as key}
              {#if key === 'site_description' || key === 'default_meta_description'}
                <div class="space-y-1"><label class="text-sm font-medium block">{labels[key] || key}<Textarea bind:value={settings[key]} class="mt-1" /></label></div>
              {:else}
                <div class="space-y-1"><label class="text-sm font-medium block">{labels[key] || key}<Input bind:value={settings[key]} class="mt-1" /></label></div>
              {/if}
            {/each}
          </CardContent>
        </Card>
      {/each}
    </div>
  {/if}
</div>


