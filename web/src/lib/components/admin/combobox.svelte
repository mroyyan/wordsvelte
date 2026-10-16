<script lang="ts">
  import CheckIcon from '@lucide/svelte/icons/check'
  import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down'
  import { Button } from '$lib/components/ui/button'
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'
  import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '$lib/components/ui/command'
  import { cn } from '$lib/utils'

  /** A searchable single-choice dropdown, for lists too long for a plain Select (e.g. timezones). */
  let {
    options, value = $bindable(''), id, placeholder = 'Select...', searchPlaceholder = 'Search...', emptyText = 'Nothing found.', class: className,
  }: {
    options: { value: string; label: string }[]
    value?: string
    id?: string
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    class?: string
  } = $props()

  let open = $state(false)
  const current = $derived(options.find(o => o.value === value))
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button {...props} {id} variant="outline" role="combobox" aria-expanded={open} class={cn('w-full justify-between font-normal', className)}>
        <span class="truncate">{current?.label ?? (value || placeholder)}</span>
        <ChevronsUpDownIcon class="ms-2 size-4 shrink-0 opacity-50" />
      </Button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent class="w-(--bits-popover-anchor-width) min-w-64 p-0" align="start">
    <Command>
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList>
        <CommandEmpty>{emptyText}</CommandEmpty>
        <CommandGroup>
          {#each options as o (o.value)}
            <CommandItem value={o.label} onSelect={() => { value = o.value; open = false }}>
              <CheckIcon class={cn('size-4', value === o.value ? 'opacity-100' : 'opacity-0')} />
              {o.label}
            </CommandItem>
          {/each}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
