<script lang="ts">
  import { page } from '$app/stores'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import {
    SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
    SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar,
  } from '$lib/components/ui/sidebar'
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '$lib/components/ui/collapsible'
  import { isCollapsible, isActivePath, activeSubHref, type NavGroupConfig } from '$lib/config/admin-nav'
  import { tr } from '$lib/i18n/admin'

  let { group }: { group: NavGroupConfig } = $props()
  const sidebar = useSidebar()
  const pathname = $derived($page.url.pathname)
  const closeMobile = () => { if (sidebar.isMobile) sidebar.setOpenMobile(false) }
</script>

<SidebarGroup>
  <SidebarGroupLabel>{tr(group.title)}</SidebarGroupLabel>
  <SidebarMenu class="gap-0.5">
    {#each group.items as item (item.title)}
      <SidebarMenuItem>
        {#if isCollapsible(item)}
          {@const activeSub = activeSubHref(pathname, item.items)}
          {@const open = activeSub !== null}
          <Collapsible {open} class="group/collapsible">
            <CollapsibleTrigger>
              {#snippet child({ props }: { props: any })}
                <SidebarMenuButton {...props} tooltipContent={tr(item.title)}>
                  {#if item.icon}<item.icon />{/if}
                  <span>{tr(item.title)}</span>
                  <ChevronRightIcon class="ms-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 rtl:rotate-180" />
                </SidebarMenuButton>
              {/snippet}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {#each item.items as sub (sub.href)}
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton isActive={sub.href === activeSub}>
                      {#snippet child({ props }: { props: any })}
                        <a href={sub.href} {...props} onclick={closeMobile}><span>{tr(sub.title)}</span></a>
                      {/snippet}
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                {/each}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        {:else}
          <SidebarMenuButton isActive={isActivePath(pathname, item.href)} tooltipContent={tr(item.title)}>
            {#snippet child({ props }: { props: any })}
              <a href={item.href} {...props} onclick={closeMobile}>
                {#if item.icon}<item.icon />{/if}
                <span>{tr(item.title)}</span>
              </a>
            {/snippet}
          </SidebarMenuButton>
        {/if}
      </SidebarMenuItem>
    {/each}
  </SidebarMenu>
</SidebarGroup>
