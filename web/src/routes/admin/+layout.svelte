<script lang="ts">
  import { page } from '$app/stores'
  import { ModeWatcher } from 'mode-watcher'
  import { SidebarProvider, SidebarInset } from '$lib/components/ui/sidebar'
  import { Toaster } from '$lib/components/ui/sonner'
  import AppSidebar from '$lib/components/layout/app-sidebar.svelte'
  import Header from '$lib/components/layout/header.svelte'
  import Main from '$lib/components/layout/main.svelte'
  import CommandMenu from '$lib/components/layout/command-menu.svelte'
  import ThemeSwitch from '$lib/components/layout/theme-switch.svelte'
  import ProfileDropdown from '$lib/components/layout/profile-dropdown.svelte'
  import { navForRole } from '$lib/config/admin-nav'
  import { isAuthPage } from '$lib/config/auth-pages'

  let { children, data } = $props()

  const authScreen = $derived(isAuthPage($page.url.pathname))
  const groups = $derived(navForRole(data.user?.role))

  // The public site has no dark styles: never leave the admin theme class behind.
  $effect(() => () => document.documentElement.classList.remove('dark'))
</script>

<ModeWatcher />
<Toaster richColors closeButton />

{#if authScreen}
  {@render children()}
{:else}
  <SidebarProvider>
    <AppSidebar {groups} siteName={data.settings?.site_name} />
    <SidebarInset class="@container/content">
      <Header>
        <CommandMenu {groups} />
        <div class="ms-auto flex items-center gap-2 sm:gap-3">
          <ThemeSwitch />
          <ProfileDropdown user={data.user} />
        </div>
      </Header>
      <Main>
        {@render children()}
      </Main>
    </SidebarInset>
  </SidebarProvider>
{/if}
