<script lang="ts">
  import type { Snippet } from 'svelte'
  import { cn } from '$lib/utils'

  let { fixed = false, fluid = false, class: className, children }: { fixed?: boolean; fluid?: boolean; class?: string; children?: Snippet } = $props()
</script>

<div
  data-layout={fixed ? 'fixed' : 'auto'}
  class={cn(
    // always fill the space under the header so list pages can pin their pagination to the bottom
    'flex flex-1 flex-col px-4 py-6',
    // fixed layout: the page owns scrolling (tables, editors)
    fixed && 'overflow-hidden',
    // not fluid: centre and cap the width on wide screens
    !fluid && '@7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
    className,
  )}
>
  {@render children?.()}
</div>
