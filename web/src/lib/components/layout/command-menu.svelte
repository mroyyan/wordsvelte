<script lang="ts">
  import { goto } from '$app/navigation'
  import SearchIcon from '@lucide/svelte/icons/search'
  import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
  import { setMode } from 'mode-watcher'
  import SunIcon from '@lucide/svelte/icons/sun'
  import MoonIcon from '@lucide/svelte/icons/moon'
  import LaptopIcon from '@lucide/svelte/icons/laptop'
  import { Button } from '$lib/components/ui/button'
  import {
    CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator,
  } from '$lib/components/ui/command'
  import { flatNav, type NavGroupConfig } from '$lib/config/admin-nav'
  import { tr } from '$lib/i18n/admin'

  let { groups, class: className = '' }: { groups: NavGroupConfig[]; class?: string } = $props()
  let open = $state(false)

  const entries = $derived(flatNav(groups))
  const sections = $derived([...new Set(entries.map(e => e.group))])

  $effect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open = !open }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  function run(fn: () => void) { open = false; fn() }
</script>

<Button variant="outline" class="relative h-9 w-full flex-1 justify-start rounded-md bg-muted/25 text-sm font-normal text-muted-foreground shadow-none hover:bg-muted/50 sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64 {className}" onclick={() => (open = true)}>
  <SearchIcon aria-hidden="true" class="absolute start-1.5 top-1/2 -translate-y-1/2" />
  <span class="ms-4">{tr('Search')}</span>
  <kbd class="pointer-events-none absolute end-[0.3rem] top-[0.3rem] hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex">
    <span class="text-xs">⌘</span>K
  </kbd>
</Button>

<CommandDialog bind:open title={tr('Search')} description={tr('Jump to a page or change the theme')} class="sm:max-w-lg">
  <CommandInput placeholder={tr('Type a command or search...')} />
  <CommandList>
    <CommandEmpty>{tr('No results found.')}</CommandEmpty>
    {#each sections as section (section)}
      <CommandGroup heading={tr(section)}>
        {#each entries.filter(e => e.group === section) as e (e.href)}
          <CommandItem value="{e.parent ? tr(e.parent) + ' ' : ''}{tr(e.title)}" onSelect={() => run(() => goto(e.href))}>
            <ArrowRightIcon class="size-4 text-muted-foreground/80" />
            {#if e.parent}<span class="text-muted-foreground">{tr(e.parent)} /</span>{/if}
            {tr(e.title)}
          </CommandItem>
        {/each}
      </CommandGroup>
    {/each}
    <CommandSeparator />
    <CommandGroup heading={tr('Theme')}>
      <CommandItem onSelect={() => run(() => setMode('light'))}><SunIcon /> {tr('Light')}</CommandItem>
      <CommandItem onSelect={() => run(() => setMode('dark'))}><MoonIcon /> {tr('Dark')}</CommandItem>
      <CommandItem onSelect={() => run(() => setMode('system'))}><LaptopIcon /> {tr('System')}</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
