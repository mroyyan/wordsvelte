<script lang="ts">
  import type { Snippet } from 'svelte'

  let { title, description, actions }: { title: string; description?: string; actions?: Snippet } = $props()
</script>

<div class="mb-4 flex flex-wrap items-end justify-between gap-2">
  <div>
    <h2 class="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
    {#if description}<p class="text-sm text-muted-foreground sm:text-base">{description}</p>{/if}
  </div>
  {#if actions}<div class="flex items-center gap-2">{@render actions()}</div>{/if}
</div>
