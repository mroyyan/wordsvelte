<script lang="ts">
  import { page } from '$app/stores'
  import '../app.css'
  import { Search, Menu, X, ChevronDown } from '@lucide/svelte'
  import WidgetRenderer from '$lib/components/widgets/WidgetRenderer.svelte'

  let { children, data }: { children: any, data: any } = $props()

  let isPublic = $derived(!$page.url.pathname.startsWith('/admin'))
  let mobileMenuOpen = $state(false)
  let today = $state(new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))

  let headerMenus = $derived(data?.menus?.filter((m: any) => m.location === 'header') || [])
  let footerMenus = $derived(data?.menus?.filter((m: any) => m.location === 'footer') || [])
  let footer1Widgets = $derived(data?.widgets?.filter((w: any) => w.sidebarArea === 'footer-1') || [])
  let footer2Widgets = $derived(data?.widgets?.filter((w: any) => w.sidebarArea === 'footer-2') || [])
  let footer3Widgets = $derived(data?.widgets?.filter((w: any) => w.sidebarArea === 'footer-3') || [])
  let footerWidgets = $derived(data?.widgets?.filter((w: any) => w.sidebarArea.startsWith('footer-')) || [])

  function buildTree(items: any[]) {
    const roots = items.filter((i: any) => !i.parentId && i.status === 'active')
    return roots.map(root => ({
      label: root.label,
      href: root.url || '#',
      children: items.filter((i: any) => i.parentId === root.id && i.status === 'active').map(c => ({
        label: c.label, href: c.url || '#'
      }))
    }))
  }

  const fallbackNav = [
    { label: 'Beranda', href: '/' },
    { label: 'Regional', href: '#', children: [
      { label: 'Kediri Raya', href: '/kategori/kediri-raya' },
      { label: 'Jawa Timur', href: '/kategori/jawa-timur' },
    ]},
    { label: 'Nasional', href: '/kategori/nasional' },
    { label: 'Dunia', href: '/kategori/dunia' },
    { label: 'Olah Raga', href: '/kategori/olahraga' },
    { label: 'Gaya Hidup', href: '/kategori/gaya-hidup' },
    { label: 'Religi', href: '/kategori/religi' },
    { label: 'Lainnya', href: '#', children: [
      { label: 'Event', href: '/kategori/event' },
      { label: 'Hiburan', href: '/kategori/hiburan' },
      { label: 'Opini', href: '/kategori/opini' },
    ]},
  ]

  let navItems = $derived.by(() => {
    if (headerMenus.length > 0 && headerMenus[0].items?.length > 0) {
      return buildTree(headerMenus[0].items)
    }
    return fallbackNav
  })
</script>

{#if isPublic}
  <!-- Top Bar -->
  <div class="bg-[#1d2129] text-white text-xs">
    <div class="max-w-6xl mx-auto px-4 h-8 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="hidden sm:inline">{today}</span>
        <div class="flex items-center gap-2">
          <a href="https://facebook.com" target="_blank" class="hover:text-red-400 transition-colors" aria-label="Facebook"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg></a>
          <a href="https://instagram.com" target="_blank" class="hover:text-red-400 transition-colors" aria-label="Instagram"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a>
          <a href="https://twitter.com" target="_blank" class="hover:text-red-400 transition-colors" aria-label="Twitter"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
          <a href="https://youtube.com" target="_blank" class="hover:text-red-400 transition-colors" aria-label="YouTube"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <i class="td-icons broken-clouds-n text-lg"></i>
        <span>28.7°C Kediri</span>
      </div>
    </div>
  </div>

  <!-- Header -->
  <header class="bg-white border-b sticky top-0 z-50 shadow-sm">
    <div class="max-w-6xl mx-auto px-4">
      <div class="flex items-center justify-between h-14">
        <a href="/" class="text-2xl font-bold text-red-600 tracking-tight">Kubus</a>
        
        <nav class="hidden lg:flex items-center gap-1">
          {#each navItems as item}
            {#if item.children?.length}
              <div class="relative group">
                <span class="px-3 py-4 text-sm font-medium text-gray-800 cursor-pointer inline-flex items-center gap-1">
                  {item.label} <ChevronDown class="h-3 w-3" />
                </span>
                <div class="absolute top-full left-0 bg-white shadow-lg border rounded-md p-2 min-w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  {#each item.children as child}
                    <a href={child.href} class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600 rounded transition-colors">{child.label}</a>
                  {/each}
                </div>
              </div>
            {:else}
              <a href={item.href} class="px-3 py-4 text-sm font-medium text-gray-800 hover:text-red-600 transition-colors">{item.label}</a>
            {/if}
          {/each}
        </nav>

        <div class="flex items-center gap-2">
          <a href="/search" class="p-2 text-gray-600 hover:text-red-600"><Search class="h-5 w-5" /></a>
          <button class="lg:hidden p-2 text-gray-600" onclick={() => mobileMenuOpen = !mobileMenuOpen}>
            {#if mobileMenuOpen}<X class="h-5 w-5" />{:else}<Menu class="h-5 w-5" />{/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Mobile Menu -->
    {#if mobileMenuOpen}
      <div class="lg:hidden border-t bg-white">
        <div class="max-w-6xl mx-auto px-4 py-4 space-y-1">
          {#each navItems as item}
            {#if item.children?.length}
              <details class="group">
                <summary class="flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-800 rounded hover:bg-gray-50 cursor-pointer">
                  {item.label} <ChevronDown class="h-3 w-3 group-open:rotate-180 transition-transform" />
                </summary>
                <div class="ml-4 mt-1 space-y-1">
                  {#each item.children as child}
                    <a href={child.href} class="block px-3 py-2 text-sm text-gray-600 hover:text-red-600 rounded hover:bg-gray-50">{child.label}</a>
                  {/each}
                </div>
              </details>
            {:else}
              <a href={item.href} class="block px-3 py-2 text-sm font-medium text-gray-800 rounded hover:bg-gray-50">{item.label}</a>
            {/if}
          {/each}
        </div>
      </div>
    {/if}
  </header>

  <!-- Main Content -->
  <main class="flex-1 bg-gray-50">
    <div class="max-w-6xl mx-auto px-4 py-6">
      {@render children()}
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-[#1d2129] text-gray-400">
    <div class="max-w-6xl mx-auto px-4 py-10">
      <div class="grid md:grid-cols-3 gap-8">
        <div>
          {#each footer1Widgets as widget (widget.id)}
            <WidgetRenderer {widget} posts={[]} categories={[]} tags={[]} context="footer" />
          {/each}
        </div>
        <div>
          {#each footer2Widgets as widget (widget.id)}
            <WidgetRenderer {widget} posts={[]} categories={[]} tags={[]} context="footer" />
          {/each}
        </div>
        <div>
          {#each footer3Widgets as widget (widget.id)}
            <WidgetRenderer {widget} posts={[]} categories={[]} tags={[]} context="footer" />
          {/each}
        </div>
      </div>
    </div>
    <div class="border-t border-gray-800">
      <div class="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between text-xs">
        <p>{data?.settings?.footer_copyright_text || '© 2026 Kubus.ID - All Rights Reserved'}</p>
        <div class="flex gap-4 mt-2 sm:mt-0">
          {#each footerMenus as fmenu}
            {#each fmenu.items?.filter((i: any) => !i.parentId && i.status === 'active') as item}
              <a href={item.url || '#'} class="hover:text-white transition-colors text-gray-500">{item.label}</a>
            {/each}
          {/each}
        </div>
      </div>
    </div>
  </footer>
{:else}
  {@render children()}
{/if}
