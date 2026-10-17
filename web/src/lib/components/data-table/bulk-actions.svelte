<script lang="ts">
  import type { Snippet } from 'svelte'
  import XIcon from '@lucide/svelte/icons/x'
  import { Button } from '$lib/components/ui/button'
  import { tr } from '$lib/i18n/admin'
  import type { DataTableState } from './data-table-state.svelte'

  let { table, entityName = 'item', actions }: { table: DataTableState<any>; entityName?: string; actions: Snippet } = $props()
  const count = $derived(table.selected.size)
</script>

{#if count > 0}
  <div role="toolbar" aria-label={tr('Bulk actions')} class="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-xl backdrop-blur">
    <Button variant="outline" size="icon" class="size-6 rounded-full" onclick={() => table.clearSelection()} aria-label={tr('Clear selection')}>
      <XIcon class="size-3.5" />
    </Button>
    <div class="flex items-center text-sm font-medium">
      <span class="me-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-primary">{count}</span>
      {count > 1 ? tr('{name}s selected', { name: tr(entityName) }) : tr('{name} selected', { name: tr(entityName) })}
    </div>
    <div class="mx-1 h-5 w-px bg-border"></div>
    {@render actions()}
  </div>
{/if}
