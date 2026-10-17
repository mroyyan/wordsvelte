<script lang="ts">
  import { page } from '$app/stores'
  import { parseDate, type DateValue } from '@internationalized/date'
  import CalendarIcon from '@lucide/svelte/icons/calendar'
  import { Button } from '$lib/components/ui/button'
  import { Calendar } from '$lib/components/ui/calendar'
  import TimePicker from '$lib/components/admin/time-picker.svelte'
  import { Label } from '$lib/components/ui/label'
  import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover'
  import { DEFAULT_TIMEZONE, formatDateWith, localeFor, utcToZonedLocal, zonedLocalToUtc } from '$lib/shared/format-date'

  /** The chosen moment as an ISO instant (UTC), or '' while nothing valid is picked. */
  let { value = $bindable(''), id = 'publishAt' }: { value?: string; id?: string } = $props()

  const settings = $derived(($page.data.settings ?? {}) as Record<string, string>)
  const timezone = $derived(settings.timezone || DEFAULT_TIMEZONE)
  const locale = $derived(localeFor(settings.language))

  // The picker works on the site's wall clock (the timezone in Settings), whatever timezone this browser is in.
  let date = $state('') // YYYY-MM-DD
  let time = $state('09:00') // HH:mm
  let open = $state(false)

  // Follow an outside change (e.g. the post finished loading).
  $effect(() => {
    if (!value) return
    const local = utcToZonedLocal(value, timezone)
    if (local && local !== `${date}T${time}`) [date, time] = local.split('T')
  })

  function commit() {
    value = date && time ? (zonedLocalToUtc(`${date}T${time}`, timezone) ?? '') : ''
  }

  const calendarValue = $derived<DateValue | undefined>(date ? parseDate(date) : undefined)
  const today = $derived(utcToZonedLocal(new Date().toISOString(), timezone).slice(0, 10))

  function pick(v: DateValue | undefined) {
    date = v ? v.toString() : ''
    if (date) open = false
    commit()
  }

  const past = $derived(!!value && Date.parse(value) <= Date.now())
  const label = $derived(date ? formatDateWith(`${date}T12:00:00Z`, { language: settings.language, date_format: 'l, d F Y', timezone: 'UTC' }) : 'Pick a date')
</script>

<div class="space-y-2">
  <Label for={id}>Publish on</Label>
  <div class="flex gap-2">
    <Popover bind:open>
      <PopoverTrigger>
        {#snippet child({ props })}
          <Button {...props} {id} type="button" variant="outline" class="min-w-0 flex-1 justify-start font-normal {date ? '' : 'text-muted-foreground'}">
            <CalendarIcon class="size-4 shrink-0" />
            <span class="truncate">{label}</span>
          </Button>
        {/snippet}
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0" align="start">
        <Calendar type="single" value={calendarValue} onValueChange={pick} {locale} minValue={parseDate(today)} captionLayout="dropdown" initialFocus />
      </PopoverContent>
    </Popover>
    <TimePicker bind:value={time} onchange={commit} class="w-28 shrink-0" />
  </div>
  {#if value && !past}
    <p class="text-xs text-muted-foreground">
      Goes live {formatDateWith(value, { ...settings, date_format: 'l, d F Y H:i' })} ({timezone}).
    </p>
  {:else if past}
    <p class="text-xs text-destructive">Pick a time in the future.</p>
  {:else}
    <p class="text-xs text-muted-foreground">Time in {timezone}, the timezone from Settings.</p>
  {/if}
</div>
