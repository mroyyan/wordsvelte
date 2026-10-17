<script lang="ts" module>
  import type { Component } from 'svelte'
  export interface FacetOption { label: string; value: string; icon?: Component<any> }
</script>

<script lang="ts">
  import PlusCircleIcon from '@lucide/svelte/icons/plus-circle'
  import CheckIcon from '@lucide/svelte/icons/check'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '$lib/components/ui/command'
  import { toggleInList } from './table-logic'
  import { tr } from '$lib/i18n/admin'

  let { title, options, selected, counts = {}, onChange }: {
    title: string
    options: FacetOption[]
    selected: string[]
    counts?: Record<string, number>
    onChange: (values: string[]) => void
  } = $props()
</script>

<Popover>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="sm" class="h-8 border-dashed">
        <PlusCircleIcon class="size-4" />
        {tr(title)}
        {#if selected.length > 0}
          <Separator orientation="vertical" class="mx-2 h-4" />
          <Badge variant="secondary" class="rounded-sm px-1 font-normal lg:hidden">{selected.length}</Badge>
          <div class="hidden space-x-1 lg:flex">
            {#if selected.length > 2}
              <Badge variant="secondary" class="rounded-sm px-1 font-normal">{tr('{n} selected', { n: selected.length })}</Badge>
            {:else}
              {#each options.filter(o => selected.includes(o.value)) as o (o.value)}
                <Badge variant="secondary" class="rounded-sm px-1 font-normal">{o.label}</Badge>
              {/each}
            {/if}
          </div>
        {/if}
      </Button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent class="w-52 p-0" align="start">
    <Command>
      <CommandInput placeholder={tr(title)} />
      <CommandList>
        <CommandEmpty>{tr('No results found.')}</CommandEmpty>
        <CommandGroup>
          {#each options as o (o.value)}
            {@const isSelected = selected.includes(o.value)}
            <CommandItem value={o.label} onSelect={() => onChange(toggleInList(selected, o.value))}>
              <div class="flex size-4 items-center justify-center rounded-sm border border-primary {isSelected ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible'}">
                <CheckIcon class="size-3.5 text-background" />
              </div>
              {#if o.icon}<o.icon class="size-4 text-muted-foreground" />{/if}
              <span>{o.label}</span>
              {#if counts[o.value] !== undefined}
                <span class="ms-auto flex size-4 items-center justify-center font-mono text-xs">{counts[o.value]}</span>
              {/if}
            </CommandItem>
          {/each}
        </CommandGroup>
        {#if selected.length > 0}
          <CommandSeparator />
          <CommandGroup>
            <CommandItem onSelect={() => onChange([])} class="justify-center text-center">{tr('Clear filters')}</CommandItem>
          </CommandGroup>
        {/if}
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
