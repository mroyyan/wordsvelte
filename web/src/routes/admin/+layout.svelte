<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import {
    Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset,
    SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
    SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
    SidebarProvider, SidebarRail, SidebarTrigger,
  } from '$lib/components/ui/sidebar'
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar'
  import { Separator } from '$lib/components/ui/separator'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu'
  import { BadgeCheck, Bell, ChevronsUpDown, CreditCard, LogOut, Sparkles, ChevronDown, ExternalLink } from '@lucide/svelte'
  import SunIcon from '@lucide/svelte/icons/sun'
  import MoonIcon from '@lucide/svelte/icons/moon'
  import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard'
  import FileTextIcon from '@lucide/svelte/icons/file-text'
  import FolderTreeIcon from '@lucide/svelte/icons/folder-tree'
  import TagsIcon from '@lucide/svelte/icons/tags'
  import ImageIcon from '@lucide/svelte/icons/image'
  import MessageSquareIcon from '@lucide/svelte/icons/message-square'
  import UsersIcon from '@lucide/svelte/icons/users'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import PaintbrushIcon from '@lucide/svelte/icons/paintbrush'
  import LayoutTemplateIcon from '@lucide/svelte/icons/layout-template'
  import MenuIcon from '@lucide/svelte/icons/menu'
  import PaletteIcon from '@lucide/svelte/icons/palette'
  import WrenchIcon from '@lucide/svelte/icons/wrench'

  let { children } = $props()
  let mounted = $state(false)
  let postsOpen = $state(false)
  let currentUser = $state<{ displayName?: string; email?: string }>({})

  $effect(() => {
    if ($page.url.pathname.startsWith('/admin/posts') ||
        $page.url.pathname.startsWith('/admin/categories') ||
        $page.url.pathname.startsWith('/admin/tags')) postsOpen = true
  })

  onMount(() => {
    mounted = true
    try { currentUser = JSON.parse(localStorage.getItem('wordsvelte_user') || '{}') } catch {}
  })

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon },
    { href: '/admin/posts', label: 'Posts', icon: FileTextIcon },
    { href: '/admin/media', label: 'Media', icon: ImageIcon },
    { href: '/admin/comments', label: 'Comments', icon: MessageSquareIcon },
    { href: '/admin/users', label: 'Users', icon: UsersIcon },
    { href: '/admin/settings', label: 'Settings', icon: SettingsIcon },
  ]

  function isActive(href: string) {
    if (href === '/admin') return $page.url.pathname === '/admin'
    return $page.url.pathname.startsWith(href)
  }
</script>

{#if $page.url.pathname === '/admin/login' || $page.url.pathname === '/admin/setup'}
  {@render children()}
{:else if !mounted}
  <div class="flex min-h-screen bg-muted/30">
    <div class="flex-1">
      <main class="px-4 py-6 @7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl">
        {@render children()}
      </main>
    </div>
  </div>
{:else}
  <SidebarProvider>
    <Sidebar>
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
                <span class="truncate font-semibold">WordSvelte</span>
                <span class="truncate text-xs">Admin Panel</span>
              </div>
              <a href="/" target="_blank" class="pointer-events-auto ml-auto p-1 rounded hover:bg-sidebar-accent transition-colors" aria-label="Open website">
                <ExternalLink class="size-3.5 text-sidebar-foreground/50" />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarMenu class="gap-0.5">
              {#each navItems.slice(0, 5) as { href, label, icon: Icon }}
              <SidebarMenuItem>
                {#if label === 'Posts'}
                  <SidebarMenuButton isActive={false} onclick={() => postsOpen = !postsOpen}>
                    <Icon class="size-4 shrink-0" />{label}
                    <ChevronDown class="ml-auto size-4 shrink-0 transition-transform {postsOpen ? 'rotate-180' : ''}" />
                  </SidebarMenuButton>
                  {#if postsOpen}
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton isActive={$page.url.pathname === '/admin/posts'}>
                          {#snippet child({ props }: { props: any })}
                            <a href="/admin/posts" {...props}>All Posts</a>
                          {/snippet}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton isActive={$page.url.pathname === '/admin/posts/new'}>
                          {#snippet child({ props }: { props: any })}
                            <a href="/admin/posts/new" {...props}>New Post</a>
                          {/snippet}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton isActive={$page.url.pathname.startsWith('/admin/categories')}>
                          {#snippet child({ props }: { props: any })}
                            <a href="/admin/categories" {...props}>Categories</a>
                          {/snippet}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton isActive={$page.url.pathname.startsWith('/admin/tags')}>
                          {#snippet child({ props }: { props: any })}
                            <a href="/admin/tags" {...props}>Tags</a>
                          {/snippet}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  {/if}
                {:else}
                  <SidebarMenuButton isActive={isActive(href)}>
                    {#snippet child({ props }: { props: any })}
                      <a {href} {...props}><Icon class="size-4 shrink-0" />{label}</a>
                    {/snippet}
                  </SidebarMenuButton>
                {/if}
              </SidebarMenuItem>
            {/each}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Appearance</SidebarGroupLabel>
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton isActive={$page.url.pathname.startsWith('/admin/appearance/themes')}>
                {#snippet child({ props }: { props: any })}
                  <a href="/admin/appearance/themes" {...props}><PaletteIcon class="size-4 shrink-0" />Themes</a>
                {/snippet}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={$page.url.pathname.startsWith('/admin/appearance/widgets')}>
                {#snippet child({ props }: { props: any })}
                  <a href="/admin/appearance/widgets" {...props}><LayoutTemplateIcon class="size-4 shrink-0" />Widgets</a>
                {/snippet}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton isActive={$page.url.pathname.startsWith('/admin/appearance/menus')}>
                {#snippet child({ props }: { props: any })}
                  <a href="/admin/appearance/menus" {...props}><MenuIcon class="size-4 shrink-0" />Menus</a>
                {/snippet}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton isActive={$page.url.pathname.startsWith('/admin/tools/migrate')}>
                {#snippet child({ props }: { props: any })}
                  <a href="/admin/tools/migrate" {...props}><WrenchIcon class="size-4 shrink-0" />Migrate</a>
                {/snippet}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Other</SidebarGroupLabel>
          <SidebarMenu class="gap-0.5">
            {#each navItems.slice(5) as { href, label, icon: Icon }}
              <SidebarMenuItem>
                <SidebarMenuButton isActive={isActive(href)}>
                  {#snippet child({ props }: { props: any })}
                    <a {href} {...props}><Icon class="size-4 shrink-0" />{label}</a>
                  {/snippet}
                </SidebarMenuButton>
              </SidebarMenuItem>
            {/each}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger class="w-full">
                <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground w-full">
                  <Avatar class="h-8 w-8 rounded-lg"><AvatarFallback class="rounded-lg">{currentUser.displayName?.[0] || 'A'}</AvatarFallback></Avatar>
              <div class="grid flex-1 text-start text-sm leading-tight">
                <span class="truncate font-semibold">{currentUser.displayName || 'Admin'}</span>
                <span class="truncate text-xs">{currentUser.email || ''}</span>
              </div>
                  <ChevronsUpDown class="ms-auto size-4 text-sidebar-foreground/60" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent class="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side="right" align="end" sideOffset={4}>
                <DropdownMenuLabel class="p-0 font-normal">
                  <div class="flex items-center gap-2 px-1 py-1.5 text-start text-sm">
                    <Avatar class="h-8 w-8 rounded-lg"><AvatarFallback class="rounded-lg">{currentUser.displayName?.[0] || 'A'}</AvatarFallback></Avatar>
                    <div class="grid flex-1 text-start text-sm leading-tight">
                      <span class="truncate font-semibold">{currentUser.displayName || 'WordSvelte'}</span>
                      <span class="truncate text-xs text-muted-foreground">{currentUser.email || ''}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem><Sparkles class="mr-2 h-4 w-4" /> Upgrade to Pro</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem><BadgeCheck class="mr-2 h-4 w-4" /> Account</DropdownMenuItem>
                  <DropdownMenuItem><CreditCard class="mr-2 h-4 w-4" /> Billing</DropdownMenuItem>
                  <DropdownMenuItem><Bell class="mr-2 h-4 w-4" /> Notifications</DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onclick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); localStorage.removeItem('wordsvelte_token'); localStorage.removeItem('wordsvelte_user'); window.location.href = '/admin/login' }}>
                  <LogOut class="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>

    <SidebarInset class="@container/content">
      <header class="sticky top-0 z-50 h-16 peer/header w-[inherit] bg-background">
        <div class="relative flex h-full items-center gap-3 p-4 sm:gap-4">
          <SidebarTrigger variant="outline" class="max-md:scale-125" />
          <Separator orientation="vertical" class="h-6" />
          <div class="flex-1"></div>
          <button onclick={() => document.documentElement.classList.toggle('dark')} class="p-2 rounded-md hover:bg-accent transition-colors" aria-label="Toggle theme">
            <SunIcon class="h-4 w-4 block dark:hidden" />
            <MoonIcon class="h-4 w-4 hidden dark:block" />
          </button>
        </div>
      </header>
      <main class="px-4 py-6 @7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl">
        {@render children()}
      </main>
    </SidebarInset>
  </SidebarProvider>
{/if}
