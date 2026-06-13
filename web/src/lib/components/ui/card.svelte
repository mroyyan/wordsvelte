<script lang="ts">
  import { cn } from '$lib/utils'
  let classname: string = $props().class ?? ''
</script>

<div class={cn('rounded-xl border bg-card text-card-foreground shadow', classname)}>
  <slot />
</div>
