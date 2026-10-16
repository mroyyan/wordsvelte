<script lang="ts">
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import ChevronsLeftIcon from '@lucide/svelte/icons/chevrons-left'
  import ChevronsRightIcon from '@lucide/svelte/icons/chevrons-right'
  import { Button } from '$lib/components/ui/button'
  import * as Select from '$lib/components/ui/select'
  import { cn } from '$lib/utils'
  import type { DataTableState } from './data-table-state.svelte'
  import { pageNumbers } from './table-logic'

  let { table, pageSizes = [10, 20, 30, 40, 50], class: className }: { table: DataTableState<any>; pageSizes?: number[]; class?: string } = $props()
  const numbers = $derived(pageNumbers(table.page, table.pages))
</script>

<div class={cn('flex items-center justify-between overflow-clip px-2 @max-2xl/content:flex-col-reverse @max-2xl/content:gap-4', className)} style="overflow-clip-margin: 1px">
  <div class="flex w-full items-center justify-between">
    <div class="flex w-[100px] items-center justify-center text-sm font-medium @2xl/content:hidden">Page {table.page} of {table.pages}</div>
    <div class="flex items-center gap-2 @max-2xl/content:flex-row-reverse">
      <Select.Root type="single" value={String(table.pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
        <Select.Trigger class="h-8 w-[70px]" aria-label="Rows per page">{table.pageSize}</Select.Trigger>
        <Select.Content side="top">
          {#each pageSizes as size (size)}
            <Select.Item value={String(size)} label={String(size)}>{size}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <p class="hidden text-sm font-medium sm:block">Rows per page</p>
    </div>
  </div>

  <div class="flex items-center sm:space-x-6 lg:space-x-8">
    <div class="flex w-[100px] items-center justify-center text-sm font-medium @max-3xl/content:hidden">Page {table.page} of {table.pages}</div>
    <div class="flex items-center space-x-2">
      <Button variant="outline" class="size-8 p-0 @max-md/content:hidden" onclick={() => table.goTo(1)} disabled={table.page <= 1}>
        <span class="sr-only">Go to first page</span><ChevronsLeftIcon class="size-4" />
      </Button>
      <Button variant="outline" class="size-8 p-0" onclick={() => table.goTo(table.page - 1)} disabled={table.page <= 1}>
        <span class="sr-only">Go to previous page</span><ChevronLeftIcon class="size-4" />
      </Button>
      {#each numbers as n, i (i)}
        {#if n === '…'}
          <span class="px-1 text-sm text-muted-foreground">…</span>
        {:else}
          <Button variant={n === table.page ? 'default' : 'outline'} class="h-8 min-w-8 px-2" onclick={() => table.goTo(n)} aria-current={n === table.page ? 'page' : undefined}>
            <span class="sr-only">Go to page </span>{n}
          </Button>
        {/if}
      {/each}
      <Button variant="outline" class="size-8 p-0" onclick={() => table.goTo(table.page + 1)} disabled={table.page >= table.pages}>
        <span class="sr-only">Go to next page</span><ChevronRightIcon class="size-4" />
      </Button>
      <Button variant="outline" class="size-8 p-0 @max-md/content:hidden" onclick={() => table.goTo(table.pages)} disabled={table.page >= table.pages}>
        <span class="sr-only">Go to last page</span><ChevronsRightIcon class="size-4" />
      </Button>
    </div>
  </div>
</div>
