<script lang="ts">
  import type { Component } from 'svelte'
  import { Button } from '$lib/components/ui/button'

  /** The page-level call to action ("Add User", "Add Post", ...): label first, icon after it, like the shadcn-admin template. */
  let { label, icon: Icon, onclick, variant = 'default', disabled = false }: {
    label: string
    icon?: Component<any>
    onclick?: (e: MouseEvent) => void
    variant?: 'default' | 'outline' | 'secondary' | 'destructive'
    disabled?: boolean
  } = $props()
</script>

<Button class="space-x-1" {variant} {disabled} {onclick}>
  <span>{label}</span>
  {#if Icon}<Icon size={18} />{/if}
</Button>
