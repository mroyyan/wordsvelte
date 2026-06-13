<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Loader2, UserPlus } from '@lucide/svelte'

  let email = $state('')
  let username = $state('')
  let password = $state('')
  let displayName = $state('')
  let error = $state('')
  let loading = $state(false)

  onMount(async () => {
    try {
      const res = await fetch('/api/auth/setup')
      const json = await res.json()
      if (!json.data?.needsSetup) goto('/admin/login', { replaceState: true })
    } catch {}
  })

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!email || !username || !password || !displayName) { error = 'All fields required'; return }
    loading = true; error = ''
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password, displayName }),
      })
      const json = await res.json()
      if (!json.success) { error = json.error || 'Setup failed'; return }
      localStorage.setItem('wordsvelte_token', json.data.token)
      localStorage.setItem('wordsvelte_user', JSON.stringify(json.data.user))
      goto('/admin')
    } catch (e: any) { error = e.message }
    finally { loading = false }
  }
</script>

<div class="container grid h-svh max-w-none items-center justify-center">
  <div class="flex w-full min-w-0 flex-col justify-center space-y-2 py-8 sm:p-8">
    <div class="mb-4 flex items-center justify-center gap-2">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-6">
        <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
      </svg>
      <h1 class="text-xl font-medium">WordSvelte Setup</h1>
    </div>

    <div class="w-full max-w-lg space-y-4 rounded-xl border bg-card text-card-foreground p-6">
      <div class="space-y-1">
        <h2 class="text-lg font-medium tracking-tight">Create Admin Account</h2>
        <p class="text-sm text-muted-foreground">Set up your first administrator account to get started.</p>
      </div>

      <form onsubmit={handleSubmit} class="grid gap-4">
        <div class="grid gap-2">
          <Label for="email">Email</Label>
          <Input id="email" type="email" bind:value={email} placeholder="admin@example.com" required />
        </div>
        <div class="grid gap-2">
          <Label for="username">Username</Label>
          <Input id="username" bind:value={username} placeholder="admin" required />
        </div>
        <div class="grid gap-2">
          <Label for="displayName">Display Name</Label>
          <Input id="displayName" bind:value={displayName} placeholder="Admin" required />
        </div>
        <div class="grid gap-2">
          <Label for="password">Password</Label>
          <Input id="password" type="password" bind:value={password} placeholder="Min 8 characters" required />
        </div>
        {#if error}<p class="text-sm text-destructive">{error}</p>{/if}
        <Button type="submit" class="mt-2 w-full" disabled={loading}>
          {#if loading}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
          {:else}
            <UserPlus class="mr-2 h-4 w-4" />
          {/if}
          Create Admin Account
        </Button>
      </form>
    </div>
  </div>
</div>
