<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import UserPlusIcon from '@lucide/svelte/icons/user-plus'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import AuthLayout from '$lib/components/auth/auth-layout.svelte'
  import PasswordInput from '$lib/components/auth/password-input.svelte'
  import { saveSession } from '$lib/auth-client'

  let { data } = $props()
  let email = $state('')
  let username = $state('')
  let password = $state('')
  let displayName = $state('')
  let error = $state('')
  let loading = $state(false)

  onMount(async () => {
    try {
      const json = await (await fetch('/api/auth/setup')).json()
      if (!json.data?.needsSetup) goto('/admin/login', { replaceState: true })
    } catch {}
  })

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!email || !username || !password || !displayName) { error = 'All fields are required'; return }
    loading = true; error = ''
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password, displayName }),
      })
      const json = await res.json()
      if (!json.success) { error = json.error || 'Setup failed'; return }
      saveSession(json.data.token, json.data.user)
      await goto('/admin', { invalidateAll: true })
    } catch (err: any) { error = err.message }
    finally { loading = false }
  }
</script>

<svelte:head><title>Create admin account</title></svelte:head>

<AuthLayout
  title="Create admin account"
  description="Set up the first administrator to get started. You can add the rest of your team afterwards."
  siteName={data.settings?.site_name}
>
  <form onsubmit={handleSubmit} class="grid gap-3">
    <div class="grid gap-2">
      <Label for="displayName">Display name</Label>
      <Input id="displayName" bind:value={displayName} placeholder="Jane Doe" autocomplete="name" required />
    </div>
    <div class="grid gap-2">
      <Label for="username">Username</Label>
      <Input id="username" bind:value={username} placeholder="admin" autocomplete="username" pattern={'[A-Za-z0-9_.\\-]{3,32}'} title="3-32 characters: letters, numbers, . _ -" required />
    </div>
    <div class="grid gap-2">
      <Label for="email">Email</Label>
      <Input id="email" type="email" bind:value={email} placeholder="admin@example.com" autocomplete="email" required />
    </div>
    <div class="grid gap-2">
      <Label for="password">Password</Label>
      <PasswordInput id="password" bind:value={password} placeholder="At least 8 characters" autocomplete="new-password" minlength={8} />
    </div>
    {#if error}
      <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
    {/if}
    <Button type="submit" class="mt-2" disabled={loading}>
      {#if loading}<Loader2Icon class="animate-spin" />{:else}<UserPlusIcon />{/if}
      Create admin account
    </Button>
  </form>
</AuthLayout>
