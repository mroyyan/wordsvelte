<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import KeyRoundIcon from '@lucide/svelte/icons/key-round'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert'
  import AuthLayout from '$lib/components/auth/auth-layout.svelte'
  import PasswordInput from '$lib/components/auth/password-input.svelte'
  import { tr } from '$lib/i18n/admin'

  let { data } = $props()
  const token = $derived($page.url.searchParams.get('token') ?? '')

  let status = $state<'checking' | 'valid' | 'invalid'>('checking')
  let password = $state('')
  let confirm = $state('')
  let error = $state('')
  let loading = $state(false)

  onMount(async () => {
    try {
      const json = await (await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)).json()
      status = json.data?.valid ? 'valid' : 'invalid'
    } catch { status = 'invalid' }
  })

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ''
    if (password !== confirm) { error = tr('Passwords do not match'); return }
    loading = true
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const json = await res.json()
      if (!json.success) { error = json.error || tr('Could not reset password'); return }
      toast.success(tr('Password updated. Please sign in.'))
      await goto('/admin/login')
    } catch (err: any) { error = err.message }
    finally { loading = false }
  }
</script>

<svelte:head><title>{tr('Reset password')}</title></svelte:head>

<AuthLayout
  title={tr('Choose a new password')}
  description={tr('Pick a password at least 8 characters long that you do not use anywhere else.')}
  siteName={data.settings?.site_name}
>
  {#if status === 'checking'}
    <div class="flex justify-center py-6"><Loader2Icon class="size-5 animate-spin text-muted-foreground" /></div>
  {:else if status === 'invalid'}
    <Alert variant="destructive">
      <AlertTitle>{tr('Link expired or already used')}</AlertTitle>
      <AlertDescription>{tr('Reset links work once and expire after an hour.')} <a href="/admin/forgot-password" class="underline underline-offset-4">{tr('Request a new one')}</a>.</AlertDescription>
    </Alert>
  {:else}
    <form onsubmit={handleSubmit} class="grid gap-3">
      <div class="grid gap-2">
        <Label for="password">{tr('New password')}</Label>
        <PasswordInput id="password" bind:value={password} autocomplete="new-password" minlength={8} />
      </div>
      <div class="grid gap-2">
        <Label for="confirm">{tr('Confirm password')}</Label>
        <PasswordInput id="confirm" bind:value={confirm} autocomplete="new-password" minlength={8} />
      </div>
      {#if error}
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      {/if}
      <Button type="submit" class="mt-2" disabled={loading}>
        {#if loading}<Loader2Icon class="animate-spin" />{:else}<KeyRoundIcon />{/if}
        {tr('Update password')}
      </Button>
    </form>
  {/if}

  {#snippet footer()}
    <a href="/admin/login" class="underline underline-offset-4 hover:text-primary">{tr('Back to sign in')}</a>
  {/snippet}
</AuthLayout>
