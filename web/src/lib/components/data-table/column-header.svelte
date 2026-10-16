<script lang="ts">
  import ArrowUpIcon from '@lucide/svelte/icons/arrow-up'
  import ArrowDownIcon from '@lucide/svelte/icons/arrow-down'
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
  import EyeOffIcon from '@lucide/svelte/icons/eye-off'
  import { Button } from '$lib/components/ui/button'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu'
  import { cn } from '$lib/utils'
  import type { DataTableState } from './data-table-state.svelte'

  let { table, column, title, sortable = true, hideable = true, class: className }: {
    table: DataTableState<any>; column: string; title: string; sortable?: boolean; hideable?: boolean; class?: string
  } = $props()

  const sorted = $derived(table.sort?.id === column ? (table.sort.desc ? 'desc' : 'asc') : null)
</script>

{#if !sortable && !hideable}
  <div class={cn(className)}>{title}</div>
{:else}
  <div class={cn('flex items-center space-x-2', className)}>
    <DropdownMenu>
      <DropdownMenuTrigger>
        {#snippet child({ props })}
          <Button {...props} variant="ghost" size="sm" class="-ms-3 h-8 data-[state=open]:bg-accent">
            <span>{title}</span>
            {#if sorted === 'desc'}<ArrowDownIcon class="ms-2 size-4" />
            {:else if sorted === 'asc'}<ArrowUpIcon class="ms-2 size-4" />
            {:else if sortable}<ChevronsUpDownIcon class="ms-2 size-4" />{/if}
          </Button>
        {/snippet}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {#if sortable}
          <DropdownMenuItem onclick={() => table.setSort(column, false)}><ArrowUpIcon class="size-3.5 text-muted-foreground/70" /> Asc</DropdownMenuItem>
          <DropdownMenuItem onclick={() => table.setSort(column, true)}><ArrowDownIcon class="size-3.5 text-muted-foreground/70" /> Desc</DropdownMenuItem>
          {#if sorted}<DropdownMenuItem onclick={() => table.clearSort()}><ChevronsUpDownIcon class="size-3.5 text-muted-foreground/70" /> Clear</DropdownMenuItem>{/if}
        {/if}
        {#if sortable && hideable}<DropdownMenuSeparator />{/if}
        {#if hideable}
          <DropdownMenuItem onclick={() => table.toggleColumn(column)}><EyeOffIcon class="size-3.5 text-muted-foreground/70" /> Hide</DropdownMenuItem>
        {/if}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
{/if}
