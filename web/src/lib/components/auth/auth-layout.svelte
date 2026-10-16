<script lang="ts">
  import type { Snippet } from 'svelte'
  import NewspaperIcon from '@lucide/svelte/icons/newspaper'
  import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
  import ZapIcon from '@lucide/svelte/icons/zap'
  import GlobeIcon from '@lucide/svelte/icons/globe'

  let {
    title,
    description,
    siteName = 'WordSvelte',
    children,
    footer,
  }: { title: string; description?: string; siteName?: string; children: Snippet; footer?: Snippet } = $props()

  const highlights = [
    { icon: NewspaperIcon, text: 'Write, schedule and publish news with a rich editor' },
    { icon: ShieldCheckIcon, text: 'Roles for authors, editors and admins' },
    { icon: ZapIcon, text: 'Runs on the edge with Cloudflare D1 and R2' },
    { icon: GlobeIcon, text: 'Import your existing WordPress site in minutes' },
  ]
</script>

<div class="relative container grid h-svh max-w-none flex-col items-center justify-center lg:grid-cols-2 lg:px-0">
  <!-- Form column -->
  <div class="lg:p-8">
    <div class="mx-auto flex w-full flex-col justify-center gap-6 px-4 py-8 sm:w-[28rem] sm:p-8">
      <a href="/" class="flex items-center justify-center gap-2" aria-label="{siteName} home">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" height="24" width="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-6">
          <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
        </svg>
        <span class="text-xl font-medium">{siteName}</span>
      </a>

      <div class="mx-auto flex w-full max-w-sm flex-col justify-center gap-4">
        <div class="flex flex-col gap-2 text-start">
          <h2 class="text-lg font-semibold tracking-tight">{title}</h2>
          {#if description}<p class="text-sm text-muted-foreground">{description}</p>{/if}
        </div>

        {@render children()}

        {#if footer}
          <p class="px-2 pt-2 text-center text-sm text-muted-foreground">{@render footer()}</p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Brand column -->
  <div class="relative hidden h-full flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_80%_-10%,oklch(0.55_0.2_265/0.45),transparent),radial-gradient(40rem_30rem_at_-10%_110%,oklch(0.6_0.18_200/0.35),transparent)]"></div>
    <div class="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:36px_36px]"></div>

    <div class="relative flex items-center gap-2 text-lg font-medium">
      <NewspaperIcon class="size-6" /> {siteName}
    </div>

    <div class="relative flex max-w-md flex-col gap-8">
      <h3 class="text-3xl leading-tight font-semibold tracking-tight">The newsroom CMS that stays out of your way.</h3>
      <ul class="flex flex-col gap-4">
        {#each highlights as h (h.text)}
          <li class="flex items-start gap-3 text-sm text-zinc-300">
            <span class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><h.icon class="size-4" /></span>
            <span class="pt-1.5">{h.text}</span>
          </li>
        {/each}
      </ul>
    </div>

    <p class="relative text-sm text-zinc-400">© {new Date().getFullYear()} {siteName}. All rights reserved.</p>
  </div>
</div>
