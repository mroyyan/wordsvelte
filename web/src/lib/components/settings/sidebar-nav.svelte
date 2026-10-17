<script lang="ts">
  import type { NavItem } from './types'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { cn } from '$lib/utils'
  import { buttonVariants } from '$lib/components/ui/button'
  import * as Select from '$lib/components/ui/select'
  import { tr } from '$lib/i18n/admin'

  let { items }: { items: NavItem[] } = $props()

  const pathname = $derived($page.url.pathname)
  const current = $derived(items.find(i => i.href === pathname) ?? items[0])
</script>

<!-- Small screens: a dropdown, like the reference template -->
<div class="p-1 md:hidden">
  <Select.Root type="single" value={current.href} onValueChange={(v) => goto(v)}>
    <Select.Trigger class="h-12 sm:w-48">
      <span class="flex items-center gap-x-4 px-2">
        <current.icon class="size-[18px] scale-125" />
        <span>{tr(current.title)}</span>
      </span>
    </Select.Trigger>
    <Select.Content>
      {#each items as item (item.href)}
        <Select.Item value={item.href} label={tr(item.title)}>
          <span class="flex gap-x-4 px-2 py-1">
            <item.icon class="size-[18px] scale-125" />
            <span>{tr(item.title)}</span>
          </span>
        </Select.Item>
      {/each}
    </Select.Content>
  </Select.Root>
</div>

<!-- md and up: a row of ghost buttons that becomes a column on large screens -->
<div class="hidden w-full min-w-40 overflow-x-auto bg-background px-1 py-2 md:block">
  <nav class="flex space-x-2 py-1 lg:flex-col lg:space-y-1 lg:space-x-0" aria-label={tr('Settings sections')}>
    {#each items as item (item.href)}
      <a
        href={item.href}
        aria-current={pathname === item.href ? 'page' : undefined}
        class={cn(
          buttonVariants({ variant: 'ghost' }),
          pathname === item.href ? 'bg-muted hover:bg-accent' : 'hover:bg-accent hover:underline',
          'justify-start',
        )}
      >
        <item.icon class="me-2 size-[18px]" />
        {tr(item.title)}
      </a>
    {/each}
  </nav>
</div>
