<script lang="ts">
  import { goto } from '$app/navigation'
  import LogInIcon from '@lucide/svelte/icons/log-in'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import AuthLayout from '$lib/components/auth/auth-layout.svelte'
  import PasswordInput from '$lib/components/auth/password-input.svelte'
  import { saveSession } from '$lib/client/auth-client'

  let { data } = $props()
  let email = $state('')
  let password = $state('')
  let error = $state('')
  let loading = $state(false)

  type Method = 'totp' | 'email' | 'recovery'
  let challenge = $state('')
  let methods = $state<Method[]>([])
  let method = $state<Method>('totp')
  let code = $state('')
  let notice = $state('')

  const METHOD_LABEL: Record<Method, string> = { totp: 'Authenticator app', email: 'Email code', recovery: 'Recovery code' }

  function finish(data: any) {
    saveSession(data.token, data.user)
    return goto('/admin', { invalidateAll: true })
  }

  function chooseMethod(m: Method) {
    method = m; code = ''; error = ''; notice = ''
    // The code only exists once we email it; the first email-only sign-in already got one from the server.
    if (m === 'email') resend()
  }

  async function send2fa(action: 'send' | 'verify') {
    const res = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'send' ? { challenge, action } : { challenge, method, code }),
    })
    return res.json()
  }

  async function handleVerify(e: Event) {
    e.preventDefault()
    loading = true; error = ''; notice = ''
    try {
      const json = await send2fa('verify')
      if (!json.success) { error = json.error || 'Verification failed'; return }
      await finish(json.data)
    } catch (err: any) { error = err.message }
    finally { loading = false }
  }

  async function resend() {
    loading = true; error = ''; notice = ''
    try {
      const json = await send2fa('send')
      if (json.success) notice = 'We sent a new code to your email.'
      else error = json.error || 'Could not send the code'
    } catch (err: any) { error = err.message }
    finally { loading = false }
  }

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
      if (json.data.twoFactor) {
        challenge = json.data.twoFactor.challenge
        methods = json.data.twoFactor.methods
        method = methods[0]
        code = ''
        notice = method === 'email' ? (json.data.twoFactor.emailSent ? 'We sent a code to your email.' : 'We could not email you a code. Use a recovery code instead.') : ''
        return
      }
      await finish(json.data)
    } catch (err: any) { error = err.message }
    finally { loading = false }
  }
</script>

<svelte:head><title>Sign in</title></svelte:head>

<AuthLayout
  title={challenge ? 'Two-factor authentication' : 'Sign in'}
  description={challenge ? 'Confirm it is you to finish signing in.' : 'Enter your email and password below to log into your account.'}
  siteName={data.settings?.site_name}
>
  {#if challenge}
  <form onsubmit={handleVerify} class="grid gap-3">
    <div class="grid gap-2">
      <Label for="code">{METHOD_LABEL[method]}</Label>
      <Input
        id="code" bind:value={code} required autofocus
        autocomplete="one-time-code"
        inputmode={method === 'recovery' ? 'text' : 'numeric'}
        placeholder={method === 'recovery' ? 'xxxxx-xxxxx' : '123456'}
      />
      <p class="text-xs text-muted-foreground">
        {#if method === 'totp'}Enter the 6-digit code from your authenticator app.
        {:else if method === 'email'}Enter the 6-digit code we emailed you. It is valid for 10 minutes.
        {:else}Enter one of the recovery codes you saved. Each works once.{/if}
      </p>
    </div>
    {#if notice}<Alert><AlertDescription>{notice}</AlertDescription></Alert>{/if}
    {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}
    <Button type="submit" class="mt-2" disabled={loading}>
      {#if loading}<Loader2Icon class="animate-spin" />{/if}
      Verify
    </Button>
    <div class="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
      {#each methods.filter(m => m !== method) as m}
        <button type="button" class="font-medium text-muted-foreground hover:opacity-75" onclick={() => chooseMethod(m)}>Use {METHOD_LABEL[m].toLowerCase()}</button>
      {/each}
      {#if method === 'email'}
        <button type="button" class="font-medium text-muted-foreground hover:opacity-75" onclick={resend} disabled={loading}>Send a new code</button>
      {/if}
      <button type="button" class="font-medium text-muted-foreground hover:opacity-75" onclick={() => { challenge = ''; password = ''; error = ''; notice = '' }}>Back</button>
    </div>
  </form>
  {:else}
  <form onsubmit={handleSubmit} class="grid gap-3">
    <div class="grid gap-2">
      <Label for="email">Email</Label>
      <Input id="email" type="email" bind:value={email} placeholder="name@example.com" autocomplete="username" required />
    </div>
    <div class="grid gap-2">
      <div class="flex items-center justify-between">
        <Label for="password">Password</Label>
        <a href="/admin/forgot-password" class="text-sm font-medium text-muted-foreground hover:opacity-75">Forgot password?</a>
      </div>
      <PasswordInput id="password" bind:value={password} />
    </div>
    {#if error}
      <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
    {/if}
    <Button type="submit" class="mt-2" disabled={loading}>
      {#if loading}<Loader2Icon class="animate-spin" />{:else}<LogInIcon />{/if}
      Sign in
    </Button>
  </form>
  {/if}

  {#snippet footer()}
    Accounts are created by an administrator. Need access? Ask your site admin.
  {/snippet}
</AuthLayout>
