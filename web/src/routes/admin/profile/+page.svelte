<script lang="ts">
  import { onMount } from 'svelte'
  import { invalidateAll } from '$app/navigation'
  import { toast } from 'svelte-sonner'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Badge } from '$lib/components/ui/badge'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import ContentSection from '$lib/components/settings/content-section.svelte'
  import PasswordInput from '$lib/components/auth/password-input.svelte'
  import { api, errorMessage } from '$lib/client/admin-api'
  import { saveSession } from '$lib/client/auth-client'
  import { tr, roleName } from '$lib/i18n/admin'

  let loading = $state(true)
  let loadError = $state('')
  let profile = $state({ displayName: '', email: '', username: '', role: '' })
  let originalEmail = $state('')
  let currentPassword = $state('')
  let busy = $state(false)
  let error = $state('')

  onMount(async () => {
    try {
      const p = await api('/api/account')
      profile = { displayName: p.displayName, email: p.email, username: p.username, role: p.role }
      originalEmail = p.email
    } catch (e) { loadError = errorMessage(e) } finally { loading = false }
  })

  function refreshStoredUser(p: any) {
    const raw = localStorage.getItem('wordsvelte_user')
    const token = localStorage.getItem('wordsvelte_token')
    if (raw && token) saveSession(token, { ...JSON.parse(raw), displayName: p.displayName, email: p.email })
  }

  async function save(e: Event) {
    e.preventDefault()
    busy = true; error = ''
    try {
      const body: Record<string, unknown> = { displayName: profile.displayName, email: profile.email }
      if (profile.email !== originalEmail) body.currentPassword = currentPassword
      const p = await api('/api/account', { method: 'PATCH', body })
      originalEmail = p.email
      currentPassword = ''
      refreshStoredUser(p)
      await invalidateAll()
      toast.success(tr('Profile updated'))
    } catch (err) { error = errorMessage(err) } finally { busy = false }
  }
</script>

<svelte:head><title>{tr('Profile')}</title></svelte:head>

<ContentSection title={tr('Profile')} desc={tr('This is how others will see you on the site.')}>
  {#if loading}
    <div class="space-y-8"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /></div>
  {:else if loadError}
    <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>
  {:else}
    <form onsubmit={save} class="space-y-8">
      <div class="space-y-2">
        <Label for="username">{tr('Username')}</Label>
        <Input id="username" value={profile.username} disabled />
        <p class="text-sm text-muted-foreground">
          {tr('Your sign-in name. Only an administrator can change it. Your role is')}
          <Badge variant="secondary" class="ms-0.5 capitalize">{roleName(profile.role)}</Badge>
        </p>
      </div>

      <div class="space-y-2">
        <Label for="displayName">{tr('Display name')}</Label>
        <Input id="displayName" bind:value={profile.displayName} required maxlength={100} placeholder={tr('Your name')} />
        <p class="text-sm text-muted-foreground">{tr('This is the name shown as the author of your articles. It can be your real name or a pseudonym.')}</p>
      </div>

      <div class="space-y-2">
        <Label for="email">{tr('Email')}</Label>
        <Input id="email" type="email" bind:value={profile.email} required />
        <p class="text-sm text-muted-foreground">{tr('Used to sign in and to receive password reset links and verification codes.')}</p>
      </div>

      {#if profile.email !== originalEmail}
        <div class="space-y-2">
          <Label for="profilePassword">{tr('Current password')}</Label>
          <PasswordInput id="profilePassword" bind:value={currentPassword} />
          <p class="text-sm text-muted-foreground">{tr('Needed to change your email address.')}</p>
        </div>
      {/if}

      {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}
      <Button type="submit" disabled={busy}>{#if busy}<Loader2Icon class="animate-spin" />{/if}{tr('Update profile')}</Button>
    </form>
  {/if}
</ContentSection>
