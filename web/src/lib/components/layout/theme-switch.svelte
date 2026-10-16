<script lang="ts">
  import { setMode, userPrefersMode } from 'mode-watcher'
  import SunIcon from '@lucide/svelte/icons/sun'
  import MoonIcon from '@lucide/svelte/icons/moon'
  import CheckIcon from '@lucide/svelte/icons/check'
  import { Button } from '$lib/components/ui/button'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '$lib/components/ui/dropdown-menu'

  const options = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ] as const
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="icon" class="scale-95 rounded-full" aria-label="Toggle theme">
        <SunIcon class="size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
        <MoonIcon class="absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        <span class="sr-only">Toggle theme</span>
      </Button>
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    {#each options as o (o.value)}
      <DropdownMenuItem onclick={() => setMode(o.value)}>
        {o.label}
        <CheckIcon class="ms-auto size-4 {userPrefersMode.current === o.value ? '' : 'hidden'}" />
      </DropdownMenuItem>
    {/each}
  </DropdownMenuContent>
</DropdownMenu>
