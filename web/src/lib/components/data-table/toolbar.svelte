<script lang="ts">
  import type { Snippet } from 'svelte'
  import XIcon from '@lucide/svelte/icons/x'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import ViewOptions from './view-options.svelte'
  import type { DataTableState } from './data-table-state.svelte'

  let { table, searchPlaceholder = 'Filter...', columns, filters }: {
    table: DataTableState<any>
    searchPlaceholder?: string
    /** Columns offered in the "View" menu. Omit to hide the menu. */
    columns?: { id: string; title: string }[]
    filters?: Snippet
  } = $props()
</script>

<div class="flex items-center justify-between">
  <div class="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:gap-x-2">
    <Input
      placeholder={searchPlaceholder}
      value={table.search}
      oninput={(e) => table.setSearch(e.currentTarget.value)}
      class="h-8 w-[150px] lg:w-[250px]"
      aria-label={searchPlaceholder}
    />
    <div class="flex gap-x-2">{@render filters?.()}</div>
    {#if table.isFiltered}
      <Button variant="ghost" onclick={() => table.reset()} class="h-8 px-2 lg:px-3">
        Reset <XIcon class="ms-2 size-4" />
      </Button>
    {/if}
  </div>
  {#if columns}<ViewOptions {table} {columns} />{/if}
</div>
