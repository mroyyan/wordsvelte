<script lang="ts">
  import EyeIcon from '@lucide/svelte/icons/eye'
  import EyeOffIcon from '@lucide/svelte/icons/eye-off'
  import { Input } from '$lib/components/ui/input'

  let {
    value = $bindable(''),
    id,
    placeholder = '********',
    autocomplete = 'current-password',
    required = true,
    minlength,
  }: { value?: string; id?: string; placeholder?: string; autocomplete?: any; required?: boolean; minlength?: number } = $props()

  let visible = $state(false)
</script>

<div class="relative">
  <Input {id} type={visible ? 'text' : 'password'} bind:value {placeholder} {autocomplete} {required} {minlength} class="pe-10" />
  <button
    type="button"
    class="absolute end-0 top-0 flex h-full w-10 items-center justify-center text-muted-foreground hover:text-foreground"
    onclick={() => (visible = !visible)}
    aria-label={visible ? 'Hide password' : 'Show password'}
    aria-pressed={visible}
  >
    {#if visible}<EyeOffIcon class="size-4" />{:else}<EyeIcon class="size-4" />{/if}
  </button>
</div>
