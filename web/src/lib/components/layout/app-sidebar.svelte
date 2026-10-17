<script lang="ts">
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import {
    Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail,
    SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  } from '$lib/components/ui/sidebar'
  import NavGroup from './nav-group.svelte'
  import type { NavGroupConfig } from '$lib/config/admin-nav'
  import { tr } from '$lib/i18n/admin'
  import pkg from '../../../../package.json'

  let { groups, siteName = 'WordSvelte' }: { groups: NavGroupConfig[]; siteName?: string } = $props()
</script>

<Sidebar collapsible="icon" variant="sidebar">
  <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" class="pointer-events-none">
          <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0">
              <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
            </svg>
          </div>
          <div class="grid flex-1 text-start text-sm leading-tight">
            <span class="truncate font-semibold">{siteName}</span>
            <span class="truncate text-xs">{tr('Admin Panel')}</span>
          </div>
          <a href="/" target="_blank" rel="noopener" class="pointer-events-auto ms-auto rounded p-1 transition-colors hover:bg-sidebar-accent" aria-label={tr('Open website')}>
            <ExternalLinkIcon class="size-3.5 text-sidebar-foreground/50" />
          </a>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarHeader>

  <SidebarContent>
    {#each groups as group (group.title)}
      <NavGroup {group} />
    {/each}
  </SidebarContent>

  <!-- hidden when the sidebar is collapsed to icons -->
  <SidebarFooter class="group-data-[collapsible=icon]:hidden">
    <a
      href="https://github.com/mroyyan/wordsvelte"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
    >
      <svg viewBox="0 0 24 24" class="size-4 shrink-0" fill="currentColor" aria-hidden="true"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" /></svg>
      <span class="font-medium">WordSvelte</span>
      <span class="ms-auto tabular-nums">v{pkg.version}</span>
    </a>
  </SidebarFooter>

  <SidebarRail />
</Sidebar>
