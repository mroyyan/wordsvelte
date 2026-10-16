<script lang="ts">
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import {
    Sidebar, SidebarContent, SidebarHeader, SidebarRail,
    SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  } from '$lib/components/ui/sidebar'
  import NavGroup from './nav-group.svelte'
  import type { NavGroupConfig } from '$lib/config/admin-nav'

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
            <span class="truncate text-xs">Admin Panel</span>
          </div>
          <a href="/" target="_blank" rel="noopener" class="pointer-events-auto ms-auto rounded p-1 transition-colors hover:bg-sidebar-accent" aria-label="Open website">
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

  <SidebarRail />
</Sidebar>
