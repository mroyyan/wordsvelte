<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Separator } from '$lib/components/ui/separator'
  import SidebarNav from './sidebar-nav.svelte'
  import type { NavItem } from './types'

  let { title, description, items, children }: { title: string; description: string; items: NavItem[]; children: Snippet } = $props()
</script>

<div class="space-y-0.5">
  <h1 class="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
  <p class="text-muted-foreground">{description}</p>
</div>
<Separator class="my-4 lg:my-6" />
<div class="flex flex-1 flex-col space-y-2 md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12">
  <aside class="top-0 self-start lg:sticky lg:w-1/5">
    <SidebarNav {items} />
  </aside>
  <div class="flex w-full p-1">
    {@render children()}
  </div>
</div>
