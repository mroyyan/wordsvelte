<script lang="ts">
  import { EMAIL_SECTION, buildSections } from '$lib/config/settings-sections'
  import ContentSection from '$lib/components/settings/content-section.svelte'
  import SettingsSectionForm from '$lib/components/admin/settings-section-form.svelte'
  import SmtpSettings from '$lib/components/admin/smtp-settings.svelte'

  let { data } = $props()

  const meta = $derived(data.section === EMAIL_SECTION.id ? EMAIL_SECTION : buildSections().find(s => s.id === data.section)!)
</script>

<svelte:head><title>{meta.title} - Settings</title></svelte:head>

<ContentSection title={meta.title} desc={meta.desc}>
  {#if data.section === EMAIL_SECTION.id}
    <SmtpSettings />
  {:else}
    {#key data.section}<SettingsSectionForm sectionId={data.section} />{/key}
  {/if}
</ContentSection>
