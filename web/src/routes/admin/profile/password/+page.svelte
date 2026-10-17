<script lang="ts">
  import { toast } from 'svelte-sonner'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import ContentSection from '$lib/components/settings/content-section.svelte'
  import PasswordInput from '$lib/components/auth/password-input.svelte'
  import { api, errorMessage } from '$lib/client/admin-api'
  import { saveSession } from '$lib/client/auth-client'
  import { tr } from '$lib/i18n/admin'

  let current = $state('')
  let next = $state('')
  let confirm = $state('')
  let busy = $state(false)
  let error = $state('')

  async function changePassword(e: Event) {
    e.preventDefault()
    error = ''
    if (next !== confirm) { error = tr('The new passwords do not match'); return }
    busy = true
    try {
      const r = await api<{ token: string }>('/api/account/password', { method: 'POST', body: { currentPassword: current, newPassword: next } })
      // Every other session was ended; this browser continues with a fresh token.
      const raw = localStorage.getItem('wordsvelte_user')
      saveSession(r.token, raw ? JSON.parse(raw) : {})
      current = next = confirm = ''
      toast.success(tr('Password changed. Other devices were signed out.'))
    } catch (err) { error = errorMessage(err) } finally { busy = false }
  }
</script>

<svelte:head><title>{tr('Password - Profile')}</title></svelte:head>

<ContentSection title={tr('Password')} desc={tr('Change the password you use to sign in. This signs you out on every other device.')}>
  <form onsubmit={changePassword} class="space-y-8">
    <div class="space-y-2">
      <Label for="current">{tr('Current password')}</Label>
      <PasswordInput id="current" bind:value={current} />
    </div>
    <div class="space-y-2">
      <Label for="next">{tr('New password')}</Label>
      <PasswordInput id="next" bind:value={next} autocomplete="new-password" minlength={8} />
      <p class="text-sm text-muted-foreground">{tr('At least 8 characters.')}</p>
    </div>
    <div class="space-y-2">
      <Label for="confirm">{tr('Confirm new password')}</Label>
      <PasswordInput id="confirm" bind:value={confirm} autocomplete="new-password" minlength={8} />
    </div>
    {#if error}<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>{/if}
    <Button type="submit" disabled={busy}>{#if busy}<Loader2Icon class="animate-spin" />{/if}{tr('Update password')}</Button>
  </form>
</ContentSection>
