<script lang="ts">
  import ClockIcon from '@lucide/svelte/icons/clock'
  import { Button } from '$lib/components/ui/button'
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'
  import { cn } from '$lib/utils'
  import { tr, msg } from '$lib/i18n/admin'

  /** "HH:mm" on a 24-hour clock. */
  let { value = $bindable('09:00'), id, class: className, onchange }: { value?: string; id?: string; class?: string; onchange?: (value: string) => void } = $props()

  let open = $state(false)
  let listsEl = $state<HTMLElement>()

  const pad = (n: number) => String(n).padStart(2, '0')
  const hour = $derived(value.slice(0, 2))
  const minute = $derived(value.slice(3, 5))

  const hours = Array.from({ length: 24 }, (_, i) => pad(i))
  // Every five minutes, plus the current minute when it is something else (e.g. an existing 09:07).
  const minutes = $derived.by(() => {
    const steps = Array.from({ length: 12 }, (_, i) => pad(i * 5))
    return steps.includes(minute) || !minute ? steps : [...steps, minute].sort()
  })

  function set(h: string, m: string) {
    value = `${h}:${m}`
    onchange?.(value)
  }

  // Bring the selected hour and minute to the middle of their columns whenever the popover opens (without scrolling the page).
  $effect(() => {
    const lists = open ? listsEl : undefined
    if (!lists) return
    // wait a frame: the popover content has just been inserted and laid out
    requestAnimationFrame(() => {
      for (const col of lists.querySelectorAll<HTMLElement>('[data-col]')) {
        const el = col.querySelector<HTMLElement>('[data-selected=true]')
        if (el) col.scrollTop = el.offsetTop - col.clientHeight / 2 + el.clientHeight / 2
      }
    })
  })
</script>

{#snippet column(items: string[], current: string, pick: (v: string) => void, label: string)}
  <div
    data-col
    class="relative flex h-56 w-14 flex-col gap-0.5 overflow-y-auto p-1"
    role="listbox"
    aria-label={tr(label)}
  >
    {#each items as item (item)}
      <Button
        type="button"
        size="sm"
        variant={item === current ? 'default' : 'ghost'}
        data-selected={item === current}
        role="option"
        aria-selected={item === current}
        class="shrink-0 tabular-nums"
        onclick={() => pick(item)}
      >
        {item}
      </Button>
    {/each}
  </div>
{/snippet}

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}
      <Button {...props} {id} type="button" variant="outline" class={cn('justify-start font-normal tabular-nums', className)} aria-label={tr('Time')}>
        <ClockIcon class="size-4 shrink-0" />
        {value}
      </Button>
    {/snippet}
  </PopoverTrigger>
  <PopoverContent class="w-auto p-0" align="end">
    <div class="flex divide-x" bind:this={listsEl}>
      {@render column(hours, hour, (h) => set(h, minute || '00'), msg('Hour'))}
      {@render column(minutes, minute, (m) => set(hour || '00', m), msg('Minute'))}
    </div>
  </PopoverContent>
</Popover>
