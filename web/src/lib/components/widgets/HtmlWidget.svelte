<script lang="ts">
  let { widget, context = 'sidebar' }: { widget: any, context?: string } = $props()
  let isFooter = $derived(context === 'footer')
</script>

{#if widget.title}
  <div class="flex items-center gap-2 mb-3">
    <div class="h-4 w-1 {isFooter ? 'bg-red-500' : 'bg-red-600'} rounded-full"></div>
    <h3 class="font-bold uppercase text-sm tracking-wider {isFooter ? 'text-white' : 'text-gray-900'}">{widget.title}</h3>
  </div>
{/if}
<div class="text-sm {isFooter ? 'text-gray-300' : 'text-gray-700'} [&_a]:text-red-400 [&_a:hover]:underline">
  {@html widget.content || ''}
</div>
