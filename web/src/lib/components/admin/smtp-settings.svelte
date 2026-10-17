<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from 'svelte-sonner'
  import SendIcon from '@lucide/svelte/icons/send'
  import Loader2Icon from '@lucide/svelte/icons/loader-2'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Alert, AlertDescription } from '$lib/components/ui/alert'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import * as Select from '$lib/components/ui/select'
  import { Separator } from '$lib/components/ui/separator'
  import PasswordInput from '$lib/components/auth/password-input.svelte'
  import { api, errorMessage } from '$lib/client/admin-api'

  type Encryption = 'none' | 'starttls' | 'tls'
  const ENCRYPTIONS: { value: Encryption; label: string; port: number }[] = [
    { value: 'starttls', label: 'STARTTLS (recommended, usually port 587)', port: 587 },
    { value: 'tls', label: 'SSL/TLS (usually port 465)', port: 465 },
    { value: 'none', label: 'None (only for a local test server)', port: 25 },
  ]

  let form = $state({ host: '', port: '587', encryption: 'starttls' as Encryption, username: '', password: '', fromEmail: '', fromName: '' })
  let passwordSet = $state(false)
  let passwordUnreadable = $state(false)
  let clearPassword = $state(false)
  let configured = $state(false)
  let loading = $state(true)
  let saving = $state(false)
  let testing = $state(false)
  let testTo = $state('')
  let error = $state('')

  function apply(d: any) {
    form = { host: d.host, port: String(d.port), encryption: d.encryption, username: d.username, password: '', fromEmail: d.fromEmail, fromName: d.fromName }
    passwordSet = d.passwordSet
    passwordUnreadable = d.passwordUnreadable
    configured = d.configured
    clearPassword = false
  }

  onMount(async () => {
    try { apply(await api('/api/settings/smtp')) } catch (e) { error = errorMessage(e) } finally { loading = false }
  })

  function pickEncryption(v: string) {
    const prev = ENCRYPTIONS.find(e => e.value === form.encryption)
    form.encryption = v as Encryption
    // Follow the usual port for the chosen mode, but never overwrite a port the admin typed themselves.
    if (!form.port || Number(form.port) === prev?.port) form.port = String(ENCRYPTIONS.find(e => e.value === v)!.port)
  }

  async function save() {
    saving = true; error = ''
    try {
      apply(await api('/api/settings/smtp', {
        method: 'PUT',
        body: { ...form, port: Number(form.port), password: form.password || undefined, clearPassword },
      }))
      toast.success(configured ? 'Email settings saved' : 'Email turned off')
    } catch (e) { error = errorMessage(e); toast.error(error) } finally { saving = false }
  }

  async function sendTest() {
    testing = true; error = ''
    try {
      const r = await api<{ to: string }>('/api/settings/smtp/test', { method: 'POST', body: testTo ? { to: testTo } : {} })
      toast.success(`Test email sent to ${r.to}`)
    } catch (e) { error = errorMessage(e); toast.error(error) } finally { testing = false }
  }
</script>

{#if error}<Alert variant="destructive" class="mb-6"><AlertDescription>{error}</AlertDescription></Alert>{/if}

{#if loading}
  <div class="space-y-8"><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /><Skeleton class="h-16 w-full" /></div>
{:else}
  <form onsubmit={(e) => { e.preventDefault(); save() }} class="space-y-8">
    <div class="grid gap-4 sm:grid-cols-[1fr_8rem]">
      <div class="space-y-2">
        <Label for="smtp_host">SMTP host</Label>
        <Input id="smtp_host" bind:value={form.host} placeholder="smtp.example.com" autocomplete="off" />
        <p class="text-sm text-muted-foreground">Leave empty to turn SMTP off. Without it, mail falls back to the RESEND_API_KEY setting.</p>
      </div>
      <div class="space-y-2">
        <Label for="smtp_port">Port</Label>
        <Input id="smtp_port" type="number" min="1" max="65535" bind:value={form.port} />
      </div>
    </div>

    <div class="space-y-2">
      <Label for="smtp_encryption">Encryption</Label>
      <Select.Root type="single" value={form.encryption} onValueChange={pickEncryption}>
        <Select.Trigger id="smtp_encryption" class="w-full">{ENCRYPTIONS.find(e => e.value === form.encryption)?.label}</Select.Trigger>
        <Select.Content>
          {#each ENCRYPTIONS as e (e.value)}<Select.Item value={e.value} label={e.label}>{e.label}</Select.Item>{/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="space-y-2">
      <Label for="smtp_username">Username</Label>
      <Input id="smtp_username" bind:value={form.username} autocomplete="off" placeholder="Optional" />
    </div>

    <div class="space-y-2">
      <Label for="smtp_password">Password</Label>
      <PasswordInput id="smtp_password" bind:value={form.password} autocomplete="new-password" required={false} placeholder={passwordSet ? 'Saved. Leave blank to keep it' : ''} />
      {#if passwordUnreadable}
        <p class="text-sm text-destructive">The saved password can no longer be read (JWT_SECRET changed). Enter it again.</p>
      {:else if passwordSet}
        <label class="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" bind:checked={clearPassword} /> Remove the saved password
        </label>
      {/if}
    </div>

    <div class="space-y-2">
      <Label for="smtp_from_email">From address</Label>
      <Input id="smtp_from_email" type="email" bind:value={form.fromEmail} placeholder="no-reply@example.com" />
    </div>

    <div class="space-y-2">
      <Label for="smtp_from_name">From name</Label>
      <Input id="smtp_from_name" bind:value={form.fromName} placeholder="My Portal" />
      <p class="text-sm text-muted-foreground">Shown as the sender of every email.</p>
    </div>

    <Button type="submit" disabled={saving}>
      {#if saving}<Loader2Icon class="animate-spin" />{/if}
      Update email settings
    </Button>
  </form>

  <Separator class="my-8" />

  <div class="space-y-3">
    <div>
      <h4 class="text-sm font-medium">Send a test email</h4>
      <p class="text-sm text-muted-foreground">Uses the saved settings. Save first if you changed anything.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <Input class="max-w-xs" type="email" bind:value={testTo} placeholder="Defaults to your own email" aria-label="Send the test to" />
      <Button type="button" variant="outline" onclick={sendTest} disabled={testing || !configured}>
        {#if testing}<Loader2Icon class="animate-spin" />{:else}<SendIcon />{/if}
        Send test
      </Button>
    </div>
  </div>
{/if}
