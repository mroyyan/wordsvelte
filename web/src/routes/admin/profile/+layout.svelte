<script lang="ts">
  import UserCogIcon from '@lucide/svelte/icons/user-cog'
  import KeyRoundIcon from '@lucide/svelte/icons/key-round'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import PaletteIcon from '@lucide/svelte/icons/palette'
  import SettingsShell from '$lib/components/settings/settings-shell.svelte'
  import { tr, msg } from '$lib/i18n/admin'

  let { children } = $props()

  const items = [
    { title: msg('Profile'), href: '/admin/profile', icon: UserCogIcon },
    { title: msg('Password'), href: '/admin/profile/password', icon: KeyRoundIcon },
    { title: msg('Security'), href: '/admin/profile/security', icon: ShieldCheckIcon },
    { title: msg('Appearance'), href: '/admin/profile/appearance', icon: PaletteIcon },
  ]
</script>

<SettingsShell title={tr('Profile')} description={tr('Manage your account, password and sign-in security.')} {items}>
  {@render children()}
</SettingsShell>
