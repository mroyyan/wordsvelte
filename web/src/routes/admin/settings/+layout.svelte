<script lang="ts">
  import SettingsShell from '$lib/components/settings/settings-shell.svelte'
  import { EMAIL_SECTION, buildSections, settingsHref } from '$lib/config/settings-sections'

  let { children } = $props()

  const items = [...buildSections(), EMAIL_SECTION].map(s => ({ title: s.title, href: settingsHref(s.id), icon: s.icon }))
</script>

<SettingsShell title="Settings" description="Manage how your site looks, reads and sends email." {items}>
  {@render children()}
</SettingsShell>
