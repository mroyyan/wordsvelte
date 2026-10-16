<script lang="ts">
  import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal'
  import { Button } from '$lib/components/ui/button'
  import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu'
  import type { DataTableState } from './data-table-state.svelte'

  let { table, columns }: { table: DataTableState<any>; columns: { id: string; title: string }[] } = $props()
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="sm" class="ms-auto hidden h-8 lg:flex">
        <SlidersHorizontalIcon class="size-4" /> View
      </Button>
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" class="w-40">
    <DropdownMenuGroup>
      <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {#each columns as c (c.id)}
        <DropdownMenuCheckboxItem checked={table.isVisible(c.id)} onCheckedChange={() => table.toggleColumn(c.id)} class="capitalize">
          {c.title}
        </DropdownMenuCheckboxItem>
      {/each}
    </DropdownMenuGroup>
  </DropdownMenuContent>
</DropdownMenu>
