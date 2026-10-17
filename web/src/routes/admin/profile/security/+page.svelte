<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import SmartphoneIcon from '@lucide/svelte/icons/smartphone'
  import MailIcon from '@lucide/svelte/icons/mail'
  import KeyRoundIcon from '@lucide/svelte/icons/key-round'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Badge } from '$lib/components/ui/badge'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import ContentSection from '$lib/components/settings/content-section.svelte'
  import PasswordInput from '$lib/components/auth/password-input.svelte'
  import { api, errorMessage } from '$lib/client/admin-api'

  type Status = { totpEnabled: boolean; totpPending: boolean; email2faEnabled: boolean; recoveryCodesRemaining: number }

  let loading = $state(true)
  let loadError = $state('')
  let email = $state('')

  // ---- two-factor ----
  let status = $state<Status | null>(null)
  let tfError = $state('')
  let tfBusy = $state(false)
  let totp = $state<{ secret: string; qrSvg: string } | null>(null)
  let totpCode = $state('')
  let emailSent = $state(false)
  let emailCode = $state('')
  let disabling = $state<'totp' | 'email' | 'recovery' | null>(null)
  let disablePassword = $state('')
  let shownCodes = $state<string[] | null>(null)

  const twoFactorOn = $derived(!!status && (status.totpEnabled || status.email2faEnabled))

  onMount(async () => {
    try {
      email = (await api('/api/account')).email
      status = await api('/api/account/2fa')
    } catch (e) { loadError = errorMessage(e) } finally { loading = false }
  })

  async function twoFactor<T = any>(body: Record<string, unknown>): Promise<T | null> {
    tfBusy = true; tfError = ''
    try { return await api<T>('/api/account/2fa', { method: 'POST', body }) }
    catch (err) { tfError = errorMessage(err); return null }
    finally { tfBusy = false }
  }

  const reload = async () => { status = await api('/api/account/2fa') }

  async function startTotp() {
    const r = await twoFactor<{ secret: string; qrSvg: string }>({ action: 'totp-setup' })
    if (r) { totp = r; totpCode = '' }
  }
  async function confirmTotp(e: Event) {
    e.preventDefault()
    const r = await twoFactor<{ recoveryCodes: string[] | null }>({ action: 'totp-confirm', code: totpCode })
    if (!r) return
    totp = null; totpCode = ''
    shownCodes = r.recoveryCodes
    await reload()
    toast.success('Authenticator app turned on')
  }

  async function sendEmailCode() {
    if (await twoFactor({ action: 'email-send' })) { emailSent = true; emailCode = ''; toast.success('Code sent. Check your inbox.') }
  }
  async function confirmEmail(e: Event) {
    e.preventDefault()
    const r = await twoFactor<{ recoveryCodes: string[] | null }>({ action: 'email-confirm', code: emailCode })
    if (!r) return
    emailSent = false; emailCode = ''
    shownCodes = r.recoveryCodes
    await reload()
    toast.success('Email codes turned on')
  }

  async function confirmDisable(e: Event) {
    e.preventDefault()
    const kind = disabling!
    const action = kind === 'totp' ? 'totp-disable' : kind === 'email' ? 'email-disable' : 'recovery-regenerate'
    const r = await twoFactor<any>({ action, password: disablePassword })
    if (!r) return
    disabling = null; disablePassword = ''
    if (kind === 'recovery') { shownCodes = r.recoveryCodes; await reload() }
    else {
      // Turning a factor off ends all sessions; this one is re-issued by signing in again.
      toast.success('Turned off. Please sign in again.')
      setTimeout(() => { window.location.href = '/admin/login' }, 1200)
    }
  }

  const codesText = $derived((shownCodes ?? []).join('\n'))
  async function copyCodes() { await navigator.clipboard.writeText(codesText); toast.success('Copied') }
  function downloadCodes() {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([`Recovery codes for ${email}\nEach code works once.\n\n${codesText}\n`], { type: 'text/plain' }))
    a.download = 'recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }
</script>

<svelte:head><title>Security - Profile</title></svelte:head>

<ContentSection title="Security" desc="Ask for a second proof when signing in, so a stolen password alone is not enough.">
  {#if loading}
    <div class="space-y-8"><Skeleton class="h-24 w-full" /><Skeleton class="h-24 w-full" /></div>
  {:else if loadError}
    <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>
  {:else}
    <div class="grid gap-5">
      <div class="flex items-center gap-2 text-sm">
        Two-factor authentication
        {#if twoFactorOn}<Badge>On</Badge>{:else}<Badge variant="outline">Off</Badge>{/if}
      </div>
    {#if tfError}<Alert variant="destructive"><AlertDescription>{tfError}</AlertDescription></Alert>{/if}

    {#if shownCodes}
      <Alert>
        <AlertDescription class="grid gap-3">
          <p class="font-medium">Save your recovery codes now. They will not be shown again.</p>
          <p class="text-xs">Each code works once, if you lose your phone or cannot receive email.</p>
          <pre class="rounded-md bg-muted p-3 font-mono text-sm leading-6" data-testid="recovery-codes">{codesText}</pre>
          <div class="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onclick={copyCodes}><CopyIcon /> Copy</Button>
            <Button type="button" size="sm" variant="outline" onclick={downloadCodes}><DownloadIcon /> Download</Button>
            <Button type="button" size="sm" onclick={() => (shownCodes = null)}>I saved them</Button>
          </div>
        </AlertDescription>
      </Alert>
    {/if}

    <!-- Authenticator app -->
    <div class="grid gap-3 rounded-lg border p-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-start gap-3">
          <SmartphoneIcon class="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p class="font-medium">Authenticator app</p>
            <p class="text-sm text-muted-foreground">Google Authenticator, 1Password, Authy and similar.</p>
          </div>
        </div>
        {#if status?.totpEnabled}
          <Button type="button" variant="outline" size="sm" onclick={() => { disabling = 'totp'; disablePassword = '' }}>Turn off</Button>
        {:else if !totp}
          <Button type="button" size="sm" onclick={startTotp} disabled={tfBusy}>Set up</Button>
        {/if}
      </div>
      {#if totp}
        <form onsubmit={confirmTotp} class="grid gap-3">
          <p class="text-sm">Scan this QR code with your app, then enter the 6-digit code it shows.</p>
          <div class="size-44 rounded-md bg-white p-2 [&>svg]:size-full" aria-label="QR code">{@html totp.qrSvg}</div>
          <p class="text-xs text-muted-foreground">Cannot scan? Enter this key manually: <code class="font-mono select-all" data-testid="totp-secret">{totp.secret}</code></p>
          <div class="flex flex-wrap gap-2">
            <Input class="max-w-40" bind:value={totpCode} inputmode="numeric" autocomplete="one-time-code" placeholder="123456" required aria-label="Code from your app" />
            <Button type="submit" disabled={tfBusy}>Verify and turn on</Button>
            <Button type="button" variant="ghost" onclick={() => (totp = null)}>Cancel</Button>
          </div>
        </form>
      {/if}
    </div>

    <!-- Email codes -->
    <div class="grid gap-3 rounded-lg border p-4">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-start gap-3">
          <MailIcon class="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p class="font-medium">Email code</p>
            <p class="text-sm text-muted-foreground">We email a 6-digit code to {email} when you sign in.</p>
          </div>
        </div>
        {#if status?.email2faEnabled}
          <Button type="button" variant="outline" size="sm" onclick={() => { disabling = 'email'; disablePassword = '' }}>Turn off</Button>
        {:else if !emailSent}
          <Button type="button" size="sm" onclick={sendEmailCode} disabled={tfBusy}>Set up</Button>
        {/if}
      </div>
      {#if emailSent}
        <form onsubmit={confirmEmail} class="grid gap-3">
          <p class="text-sm">We sent a code to your email. Enter it to confirm that you can receive it.</p>
          <div class="flex flex-wrap gap-2">
            <Input class="max-w-40" bind:value={emailCode} inputmode="numeric" autocomplete="one-time-code" placeholder="123456" required aria-label="Code from your email" />
            <Button type="submit" disabled={tfBusy}>Verify and turn on</Button>
            <Button type="button" variant="ghost" onclick={sendEmailCode} disabled={tfBusy}>Send again</Button>
            <Button type="button" variant="ghost" onclick={() => (emailSent = false)}>Cancel</Button>
          </div>
        </form>
      {/if}
    </div>

    <!-- Recovery codes -->
    {#if twoFactorOn}
      <div class="flex items-center justify-between gap-3 rounded-lg border p-4">
        <div class="flex items-start gap-3">
          <KeyRoundIcon class="mt-0.5 size-5 text-muted-foreground" />
          <div>
            <p class="font-medium">Recovery codes</p>
            <p class="text-sm text-muted-foreground">{status?.recoveryCodesRemaining} unused {status?.recoveryCodesRemaining === 1 ? 'code' : 'codes'} left.</p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onclick={() => { disabling = 'recovery'; disablePassword = '' }}>Make new codes</Button>
      </div>
    {/if}

    {#if disabling}
      <form onsubmit={confirmDisable} class="grid gap-3 rounded-lg border border-destructive/40 p-4">
        <p class="text-sm font-medium">
          {#if disabling === 'recovery'}Enter your password to replace your recovery codes. The old ones stop working.
          {:else}Enter your password to turn this off. You will be signed out everywhere.{/if}
        </p>
        <PasswordInput id="disablePassword" bind:value={disablePassword} />
        <div class="flex gap-2">
          <Button type="submit" variant={disabling === 'recovery' ? 'default' : 'destructive'} disabled={tfBusy}>Confirm</Button>
          <Button type="button" variant="ghost" onclick={() => (disabling = null)}>Cancel</Button>
        </div>
      </form>
    {/if}

    </div>
  {/if}
</ContentSection>
