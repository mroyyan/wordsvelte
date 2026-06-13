<script lang="ts">
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { LogIn, Loader2 } from 'lucide-svelte'

  let email = $state('')
  let password = $state('')
  let error = $state('')
  let loading = $state(false)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    loading = true; error = ''
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const json = await res.json()
      if (!json.success) { error = json.error || 'Login failed'; return }
      localStorage.setItem('kubus_token', json.data.token)
      localStorage.setItem('kubus_user', JSON.stringify(json.data.user))
      goto('/admin')
    } catch (e: any) { error = e.message }
    finally { loading = false }
  }
</script>

<div class="container grid h-svh max-w-none items-center justify-center">
  <div class="mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:p-8">
    <div class="mb-4 flex items-center justify-center gap-2">
      <svg id="kubus-logo" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-6">
        <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
      </svg>
      <h1 class="text-xl font-medium">Kubus Admin</h1>
    </div>

    <Card class="max-w-sm gap-4">
      <CardHeader>
        <CardTitle class="text-lg tracking-tight">Sign in</CardTitle>
        <CardDescription>
          Enter your email and password below to log into<br class="max-sm:hidden" /> your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onsubmit={handleSubmit} class="grid gap-3">
          <div class="grid gap-2">
            <Label for="email">Email</Label>
            <Input id="email" type="email" bind:value={email} placeholder="name@example.com" required />
          </div>
          <div class="grid gap-2">
            <Label for="password">Password</Label>
            <Input id="password" type="password" bind:value={password} placeholder="********" required />
          </div>
          {#if error}<p class="text-sm text-destructive">{error}</p>{/if}
          <Button type="submit" class="mt-2" disabled={loading}>
            {#if loading}
              <Loader2 class="h-4 w-4 animate-spin" />
            {:else}
              <LogIn class="h-4 w-4" />
            {/if}
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p class="px-8 text-center text-sm text-balance text-muted-foreground">
          By clicking sign in, you agree to our{' '}
          <a href="/terms" class="underline underline-offset-4 hover:text-primary">Terms of Service</a>{' '}
          and{' '}
          <a href="/privacy" class="underline underline-offset-4 hover:text-primary">Privacy Policy</a>.
        </p>
      </CardFooter>
    </Card>
  </div>
</div>

