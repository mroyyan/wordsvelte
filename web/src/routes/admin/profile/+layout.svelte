<script lang="ts">
  import UserCogIcon from '@lucide/svelte/icons/user-cog'
  import KeyRoundIcon from '@lucide/svelte/icons/key-round'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import PaletteIcon from '@lucide/svelte/icons/palette'
  import SettingsShell from '$lib/components/settings/settings-shell.svelte'

  let { children } = $props()

  const items = [
    { title: 'Profile', href: '/admin/profile', icon: UserCogIcon },
    { title: 'Password', href: '/admin/profile/password', icon: KeyRoundIcon },
    { title: 'Security', href: '/admin/profile/security', icon: ShieldCheckIcon },
    { title: 'Appearance', href: '/admin/profile/appearance', icon: PaletteIcon },
  ]
</script>

<SettingsShell title="Profile" description="Manage your account, password and sign-in security." {items}>
  {@render children()}
</SettingsShell>
