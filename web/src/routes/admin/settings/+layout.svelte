<script lang="ts">
  import SettingsShell from '$lib/components/settings/settings-shell.svelte'
  import { EMAIL_SECTION, buildSections, settingsHref } from '$lib/config/settings-sections'
  import { tr } from '$lib/i18n/admin'

  let { children } = $props()

  const items = $derived([...buildSections(), EMAIL_SECTION].map(s => ({ title: tr(s.title), href: settingsHref(s.id), icon: s.icon })))
</script>

<SettingsShell title={tr('Settings')} description={tr('Manage how your site looks, reads and sends email.')} {items}>
  {@render children()}
</SettingsShell>
