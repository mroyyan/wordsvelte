<script lang="ts">
  import { cn } from '$lib/utils'

  let className: string = $props().class ?? ''
  let variant: 'default' | 'destructive' | 'outline' | 'ghost' | 'link' = $props().variant ?? 'default'
  let size: 'default' | 'sm' | 'lg' | 'icon' = $props().size ?? 'default'
  let disabled: boolean = $props().disabled ?? false
  let { class: _, variant: _v, size: _s, disabled: _d, ...rest } = $props()

  const variants: Record<string, string> = {
    default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
    outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
  }
  const sizes: Record<string, string> = {
    default: 'h-9 px-4 py-2',
    sm: 'h-8 rounded-md px-3 text-xs',
    lg: 'h-10 rounded-md px-8',
    icon: 'h-9 w-9',
  }
</script>

<button class={cn('inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50', variants[variant], sizes[size], className)} disabled={disabled} {...rest}>
  <slot />
</button>
