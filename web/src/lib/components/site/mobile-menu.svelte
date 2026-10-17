<script lang="ts">
  import { t } from '$lib/i18n'
  import { page } from '$app/stores'
  import { ChevronDown, X } from '@lucide/svelte'
  import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '$lib/components/ui/sheet'

  interface Item { label: string; href: string; children?: { label: string; href: string }[] }

  let { open = $bindable(false), items, siteName = 'WordSvelte' }: { open?: boolean; items: Item[]; siteName?: string } = $props()

  // Navigating (including back/forward) always leaves the menu closed.
  $effect(() => {
    $page.url.pathname
    open = false
  })

  const isActive = (href: string) => href !== '#' && ($page.url.pathname === href || (href !== '/' && $page.url.pathname.startsWith(href + '/')))
</script>

<Sheet bind:open>
  <SheetContent side="left" showCloseButton={false} class="w-[85%] max-w-xs gap-0 border-neutral-800 bg-black p-0 text-gray-100">
    <SheetHeader class="flex-row items-center justify-between border-b border-neutral-800 p-4">
      <div>
        <SheetTitle class="text-lg font-bold tracking-tight text-white">{siteName}</SheetTitle>
        <SheetDescription class="sr-only">{t('common.menuNavigation')}</SheetDescription>
      </div>
      <button type="button" class="rounded p-2 text-gray-300 hover:bg-white/10 hover:text-white" aria-label={t('common.closeMenu')} onclick={() => (open = false)}>
        <X class="h-5 w-5" />
      </button>
    </SheetHeader>

    <nav class="flex-1 space-y-1 overflow-y-auto p-3" aria-label={t('common.mainMenu')}>
      {#each items as item}
        {#if item.children?.length}
          <details class="group" open={item.children.some(c => isActive(c.href))}>
            <summary class="flex cursor-pointer list-none items-center justify-between rounded-md px-3 py-2.5 text-[15px] font-medium text-gray-100 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
              {item.label}
              <ChevronDown class="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
            </summary>
            <div class="ml-3 mt-1 space-y-0.5 border-l border-neutral-800 pl-3">
              {#each item.children as child}
                <a href={child.href} class="block rounded-md px-3 py-2 text-sm hover:bg-white/10 hover:text-red-400 {isActive(child.href) ? 'text-red-400' : 'text-gray-400'}">{child.label}</a>
              {/each}
            </div>
          </details>
        {:else}
          <a href={item.href} class="block rounded-md px-3 py-2.5 text-[15px] font-medium hover:bg-white/10 {isActive(item.href) ? 'text-red-400' : 'text-gray-100'}">{item.label}</a>
        {/if}
      {/each}
    </nav>
  </SheetContent>
</Sheet>
