<script lang="ts">
  import { onMount } from 'svelte'
  import { invalidateAll } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import SmartphoneIcon from '@lucide/svelte/icons/smartphone'
  import MailIcon from '@lucide/svelte/icons/mail'
  import KeyRoundIcon from '@lucide/svelte/icons/key-round'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import DownloadIcon from '@lucide/svelte/icons/download'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Badge } from '$lib/components/ui/badge'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card'
  import PageHeader from '$lib/components/layout/page-header.svelte'
  import PasswordInput from '$lib/components/auth/password-input.svelte'
  import { api, errorMessage } from '$lib/client/admin-api'
  import { saveSession } from '$lib/client/auth-client'

  type Status = { totpEnabled: boolean; totpPending: boolean; email2faEnabled: boolean; recoveryCodesRemaining: number }

  let loading = $state(true)
  let loadError = $state('')

  // ---- profile ----
  let profile = $state({ displayName: '', email: '', username: '', role: '' })
  let originalEmail = ''
  let profilePassword = $state('')
  let profileBusy = $state(false)
  let profileError = $state('')

  // ---- password ----
  let current = $state('')
  let next = $state('')
  let confirm = $state('')
  let pwBusy = $state(false)
  let pwError = $state('')

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
      const p = await api('/api/account')
      profile = { displayName: p.displayName, email: p.email, username: p.username, role: p.role }
      originalEmail = p.email
      status = await api('/api/account/2fa')
    } catch (e) { loadError = errorMessage(e) } finally { loading = false }
  })

  function refreshStoredUser(p: any) {
    const raw = localStorage.getItem('wordsvelte_user')
    const token = localStorage.getItem('wordsvelte_token')
    if (raw && token) saveSession(token, { ...JSON.parse(raw), displayName: p.displayName, email: p.email })
  }

  async function saveProfile(e: Event) {
    e.preventDefault()
    profileBusy = true; profileError = ''
    try {
      const body: Record<string, unknown> = { displayName: profile.displayName, email: profile.email }
      if (profile.email !== originalEmail) body.currentPassword = profilePassword
      const p = await api('/api/account', { method: 'PATCH', body })
      originalEmail = p.email
      profilePassword = ''
      refreshStoredUser(p)
      await invalidateAll()
      toast.success('Profile updated')
    } catch (err) { profileError = errorMessage(err) } finally { profileBusy = false }
  }

  async function changePassword(e: Event) {
    e.preventDefault()
    pwError = ''
    if (next !== confirm) { pwError = 'The new passwords do not match'; return }
    pwBusy = true
    try {
      const r = await api<{ token: string }>('/api/account/password', { method: 'POST', body: { currentPassword: current, newPassword: next } })
      // Every other session was ended; this browser continues with a fresh token.
      const raw = localStorage.getItem('wordsvelte_user')
      saveSession(r.token, raw ? JSON.parse(raw) : {})
      current = next = confirm = ''
      toast.success('Password changed. Other devices were signed out.')
    } catch (err) { pwError = errorMessage(err) } finally { pwBusy = false }
  }

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
    a.href = URL.createObjectURL(new Blob([`Recovery codes for ${profile.email}\nEach code works once.\n\n${codesText}\n`], { type: 'text/plain' }))
    a.download = 'recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }
</script>

<svelte:head><title>Profile</title></svelte:head>

<PageHeader title="Profile" description="Your account, password and sign-in security" />

{#if loading}
  <div class="grid max-w-2xl gap-4"><Skeleton class="h-64 w-full rounded-xl" /><Skeleton class="h-64 w-full rounded-xl" /></div>
{:else if loadError}
  <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>
{:else}
  <div class="grid max-w-2xl gap-4">
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Signed in as <span class="font-medium">@{profile.username}</span> <Badge variant="secondary" class="ms-1 capitalize">{profile.role}</Badge></CardDescription>
      </CardHeader>
      <CardContent>
        <form onsubmit={saveProfile} class="grid gap-4">
          <div class="grid gap-2">
            <Label for="displayName">Display name</Label>
            <Input id="displayName" bind:value={profile.displayName} required maxlength={100} />
          </div>
          <div class="grid gap-2">
            <Label for="email">Email</Label>
            <Input id="email" type="email" bind:value={profile.email} required />
          </div>
          {#if profile.email !== originalEmail}
            <div class="grid gap-2">
              <Label for="profilePassword">Current password</Label>
              <PasswordInput id="profilePassword" bind:value={profilePassword} />
              <p class="text-xs text-muted-foreground">Needed to change your email address.</p>
            </div>
          {/if}
          {#if profileError}<Alert variant="destructive"><AlertDescription>{profileError}</AlertDescription></Alert>{/if}
          <div><Button type="submit" disabled={profileBusy}>{#if profileBusy}<Loader2Icon class="animate-spin" />{/if}Save profile</Button></div>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Changing it signs you out on every other device.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onsubmit={changePassword} class="grid gap-4">
          <div class="grid gap-2">
            <Label for="current">Current password</Label>
            <PasswordInput id="current" bind:value={current} />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="grid gap-2">
              <Label for="next">New password</Label>
              <PasswordInput id="next" bind:value={next} autocomplete="new-password" minlength={8} />
            </div>
            <div class="grid gap-2">
              <Label for="confirm">Confirm new password</Label>
              <PasswordInput id="confirm" bind:value={confirm} autocomplete="new-password" minlength={8} />
            </div>
          </div>
          {#if pwError}<Alert variant="destructive"><AlertDescription>{pwError}</AlertDescription></Alert>{/if}
          <div><Button type="submit" disabled={pwBusy}>{#if pwBusy}<Loader2Icon class="animate-spin" />{/if}Change password</Button></div>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <ShieldCheckIcon class="size-5" /> Two-factor authentication
          {#if twoFactorOn}<Badge>On</Badge>{:else}<Badge variant="outline">Off</Badge>{/if}
        </CardTitle>
        <CardDescription>Ask for a second proof when signing in, so a stolen password alone is not enough.</CardDescription>
      </CardHeader>
      <CardContent class="grid gap-5">
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
                <p class="text-sm text-muted-foreground">We email a 6-digit code to {profile.email} when you sign in.</p>
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
      </CardContent>
    </Card>
  </div>
{/if}
