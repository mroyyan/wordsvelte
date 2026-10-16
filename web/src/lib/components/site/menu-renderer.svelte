<script lang="ts">
  import { ChevronDown } from '@lucide/svelte'

  let { menus }: { menus: any[] } = $props()

  function buildTree(items: any[]) {
    const roots = items.filter((i: any) => !i.parentId)
    return roots.map(root => ({
      ...root,
      children: items.filter((i: any) => i.parentId === root.id)
    }))
  }

  let tree = $derived(menus.length > 0 ? buildTree(menus[0]?.items || []) : [])
</script>

{#if tree.length > 0}
  {#each tree as item}
    {#if item.children.length > 0}
      <div class="relative group">
        <a
          href={item.url || '#'}
          class="px-3 py-4 text-sm font-medium text-gray-800 hover:text-red-600 transition-colors inline-flex items-center gap-1"
        >
          {item.label} <ChevronDown class="h-3 w-3" />
        </a>
        <div class="absolute top-full left-0 bg-white shadow-lg border rounded-md p-2 min-w-40 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
          {#each item.children as child}
            <a
              href={child.url || '#'}
              class="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-red-600 rounded transition-colors"
            >
              {child.label}
            </a>
          {/each}
        </div>
      </div>
    {:else}
      <a
        href={item.url || '#'}
        class="px-3 py-4 text-sm font-medium text-gray-800 hover:text-red-600 transition-colors"
      >
        {item.label}
      </a>
    {/if}
  {/each}
{/if}
