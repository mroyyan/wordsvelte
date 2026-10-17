<script lang="ts">
  import { mode, setMode } from 'mode-watcher'
  import { cn } from '$lib/utils'
  import ContentSection from '$lib/components/settings/content-section.svelte'

  const choose = (v: 'light' | 'dark') => setMode(v)
</script>

<svelte:head><title>Appearance - Profile</title></svelte:head>

<ContentSection title="Appearance" desc="Customize how the dashboard looks. Automatically switch between day and night themes.">
  <div class="space-y-2">
    <p class="text-sm leading-none font-medium">Theme</p>
    <p class="text-sm text-muted-foreground">Select the theme for the dashboard.</p>
    <div class="grid max-w-md grid-cols-2 gap-8 pt-2" role="radiogroup" aria-label="Theme">
      <button type="button" role="radio" aria-checked={mode.current === 'light'} onclick={() => choose('light')} class="text-start">
        <div class={cn('items-center rounded-md border-2 border-muted p-1 hover:border-accent', mode.current === 'light' && 'border-primary')}>
          <div class="space-y-2 rounded-sm bg-[#ecedef] p-2">
            <div class="space-y-2 rounded-md bg-white p-2 shadow-xs">
              <div class="h-2 w-20 rounded-lg bg-[#ecedef]"></div>
              <div class="h-2 w-24 rounded-lg bg-[#ecedef]"></div>
            </div>
            <div class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
              <div class="size-4 rounded-full bg-[#ecedef]"></div>
              <div class="h-2 w-24 rounded-lg bg-[#ecedef]"></div>
            </div>
            <div class="flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs">
              <div class="size-4 rounded-full bg-[#ecedef]"></div>
              <div class="h-2 w-24 rounded-lg bg-[#ecedef]"></div>
            </div>
          </div>
        </div>
        <span class="block w-full p-2 text-center text-sm font-normal">Light</span>
      </button>

      <button type="button" role="radio" aria-checked={mode.current === 'dark'} onclick={() => choose('dark')} class="text-start">
        <div class={cn('items-center rounded-md border-2 border-muted bg-popover p-1 hover:bg-accent hover:text-accent-foreground', mode.current === 'dark' && 'border-primary')}>
          <div class="space-y-2 rounded-sm bg-slate-950 p-2">
            <div class="space-y-2 rounded-md bg-slate-800 p-2 shadow-xs">
              <div class="h-2 w-20 rounded-lg bg-slate-400"></div>
              <div class="h-2 w-24 rounded-lg bg-slate-400"></div>
            </div>
            <div class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
              <div class="size-4 rounded-full bg-slate-400"></div>
              <div class="h-2 w-24 rounded-lg bg-slate-400"></div>
            </div>
            <div class="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-xs">
              <div class="size-4 rounded-full bg-slate-400"></div>
              <div class="h-2 w-24 rounded-lg bg-slate-400"></div>
            </div>
          </div>
        </div>
        <span class="block w-full p-2 text-center text-sm font-normal">Dark</span>
      </button>
    </div>
  </div>
</ContentSection>
