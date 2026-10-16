<script lang="ts">
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import SettingsIcon from '@lucide/svelte/icons/settings'
  import LogOutIcon from '@lucide/svelte/icons/log-out'
  import UserIcon from '@lucide/svelte/icons/user'
  import { Avatar, AvatarFallback } from '$lib/components/ui/avatar'
  import { Button } from '$lib/components/ui/button'
  import {
    DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel,
    DropdownMenuSeparator, DropdownMenuTrigger,
  } from '$lib/components/ui/dropdown-menu'
  import { initials, signOut, type SessionUser } from '$lib/client/auth-client'

  let { user }: { user: SessionUser | null } = $props()
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" class="relative size-8 rounded-full" aria-label="Account menu">
        <Avatar class="size-8"><AvatarFallback>{initials(user?.displayName)}</AvatarFallback></Avatar>
      </Button>
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent class="w-56" align="end">
    <DropdownMenuLabel class="font-normal">
      <div class="flex flex-col gap-1.5">
        <p class="text-sm leading-none font-medium">{user?.displayName}</p>
        <p class="text-xs leading-none text-muted-foreground">{user?.email}</p>
        <p class="text-xs leading-none text-muted-foreground capitalize">{user?.role}</p>
      </div>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <DropdownMenuItem onclick={() => window.open('/', '_blank')}>
        <ExternalLinkIcon /> View site
      </DropdownMenuItem>
      <DropdownMenuItem onclick={() => (window.location.href = '/admin/profile')}>
        <UserIcon /> Profile &amp; security
      </DropdownMenuItem>
      {#if user?.role === 'admin'}
        <DropdownMenuItem onclick={() => (window.location.href = '/admin/settings')}>
          <SettingsIcon /> Settings
        </DropdownMenuItem>
      {/if}
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive" onclick={signOut}>
      <LogOutIcon /> Sign out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
