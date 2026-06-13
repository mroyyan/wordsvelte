<script lang="ts">
  import PopularPosts from './PopularPosts.svelte'
  import RecentPosts from './RecentPosts.svelte'
  import TagCloud from './TagCloud.svelte'
  import Categories from './Categories.svelte'
  import HtmlWidget from './HtmlWidget.svelte'

  let { widget, posts, categories, tags, context = 'sidebar' }: { widget: any, posts: any[], categories: any[], tags: any[], context?: string } = $props()

  let settings = $derived(() => {
    if (!widget.settings) return {}
    try { return JSON.parse(widget.settings) } catch { return {} }
  })
</script>

{#if widget.status === 'active'}
  <div class="widget widget-{widget.widgetType}">
    {#if widget.widgetType === 'html'}
      <HtmlWidget {widget} {context} />
    {:else if widget.widgetType === 'popular_posts'}
      <PopularPosts title={widget.title} {posts} {context} limit={settings().limit || 5} />
    {:else if widget.widgetType === 'recent_posts'}
      <RecentPosts title={widget.title} {posts} {context} limit={settings().limit || 5} />
    {:else if widget.widgetType === 'tag_cloud'}
      <TagCloud title={widget.title} {tags} {context} limit={settings().limit || 20} />
    {:else if widget.widgetType === 'categories'}
      <Categories title={widget.title} {categories} {context} limit={settings().limit || 10} />
    {/if}
  </div>
{/if}
