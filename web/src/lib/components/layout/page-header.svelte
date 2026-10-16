<script lang="ts">
  import type { Snippet } from 'svelte'

  let { title, description, actions }: { title: string; description?: string; actions?: Snippet } = $props()
</script>

<div class="mb-4 flex flex-wrap items-end justify-between gap-2">
  <div>
    <h2 class="text-2xl font-bold tracking-tight">{title}</h2>
    {#if description}<p class="text-muted-foreground">{description}</p>{/if}
  </div>
  {#if actions}<div class="flex items-center gap-2">{@render actions()}</div>{/if}
</div>
