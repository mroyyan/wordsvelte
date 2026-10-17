<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Separator } from '$lib/components/ui/separator'

  let { title, desc, children }: { title: string; desc: string; children: Snippet } = $props()
</script>

<div class="flex flex-1 flex-col">
  <div class="flex-none">
    <h3 class="text-lg font-medium">{title}</h3>
    <p class="text-sm text-muted-foreground">{desc}</p>
  </div>
  <Separator class="my-4 flex-none" />
  <div class="h-full w-full pb-12">
    <div class="-mx-1 px-1.5 lg:max-w-xl">{@render children()}</div>
  </div>
</div>
