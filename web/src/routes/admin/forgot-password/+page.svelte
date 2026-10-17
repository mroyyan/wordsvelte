<script lang="ts">
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import MailCheckIcon from '@lucide/svelte/icons/mail-check'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert'
  import AuthLayout from '$lib/components/auth/auth-layout.svelte'
  import { tr } from '$lib/i18n/admin'

  let { data } = $props()
  let email = $state('')
  let error = $state('')
  let loading = $state(false)
  let sent = $state(false)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    loading = true; error = ''
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json()
      if (!json.success) { error = json.error || tr('Something went wrong'); return }
      sent = true
    } catch (err: any) { error = err.message }
    finally { loading = false }
  }
</script>

<svelte:head><title>{tr('Forgot password')}</title></svelte:head>

<AuthLayout
  title={tr('Forgot password')}
  description={tr('Enter your registered email and we will send you a link to reset your password.')}
  siteName={data.settings?.site_name}
>
  {#if sent}
    <Alert>
      <MailCheckIcon />
      <AlertTitle>{tr('Check your inbox')}</AlertTitle>
      <AlertDescription>{tr('If an account exists for {email}, a reset link is on its way. It stays valid for one hour.', { email })}</AlertDescription>
    </Alert>
  {:else}
    <form onsubmit={handleSubmit} class="grid gap-3">
      <div class="grid gap-2">
        <Label for="email">{tr('Email')}</Label>
        <Input id="email" type="email" bind:value={email} placeholder="name@example.com" autocomplete="email" required />
      </div>
      {#if error}
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      {/if}
      <Button type="submit" class="mt-2" disabled={loading}>
        {tr('Continue')}
        {#if loading}<Loader2Icon class="animate-spin" />{:else}<ArrowRightIcon />{/if}
      </Button>
    </form>
  {/if}

  {#snippet footer()}
    {tr('Remembered it?')} <a href="/admin/login" class="underline underline-offset-4 hover:text-primary">{tr('Back to sign in')}</a>
  {/snippet}
</AuthLayout>
