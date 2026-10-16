<script lang="ts">
  import type { Snippet } from 'svelte'
  import { SidebarTrigger } from '$lib/components/ui/sidebar'
  import { Separator } from '$lib/components/ui/separator'
  import { cn } from '$lib/utils'

  let { fixed = true, class: className, children }: { fixed?: boolean; class?: string; children?: Snippet } = $props()
  let offset = $state(0)

  $effect(() => {
    const onScroll = () => { offset = document.body.scrollTop || document.documentElement.scrollTop }
    onScroll()
    document.addEventListener('scroll', onScroll, { passive: true })
    return () => document.removeEventListener('scroll', onScroll)
  })

  const scrolled = $derived(offset > 10 && fixed)
</script>

<!-- Solid background at all times: content scrolling underneath must never show through the header. -->
<header class={cn('z-50 h-16 bg-background', fixed && 'header-fixed peer/header sticky top-0 w-[inherit]', scrolled ? 'border-b shadow-sm' : 'border-b border-transparent', className)}>
  <div class="relative flex h-full items-center gap-3 p-4 sm:gap-4">
    <SidebarTrigger variant="outline" class="max-md:scale-125" />
    <Separator orientation="vertical" class="h-6" />
    {@render children?.()}
  </div>
</header>
