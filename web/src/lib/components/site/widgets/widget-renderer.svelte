<script lang="ts">
  import { page } from '$app/stores'
  import PopularPosts from './popular-posts.svelte'
  import RecentPosts from './recent-posts.svelte'
  import TagCloud from './tag-cloud.svelte'
  import Categories from './categories.svelte'
  import HtmlWidget from './html-widget.svelte'

  let { widget, categories, tags, context = 'sidebar' }: { widget: any, categories: any[], tags: any[], context?: string } = $props()

  // site-wide lists from the layout, not the posts of the page being viewed
  const latest = $derived(($page.data.widgetPosts?.latest ?? []) as any[])
  const popular = $derived(($page.data.widgetPosts?.popular ?? []) as any[])

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
      <PopularPosts title={widget.title} posts={popular} {context} limit={settings().limit || 5} />
    {:else if widget.widgetType === 'recent_posts'}
      <RecentPosts title={widget.title} posts={latest} {context} limit={settings().limit || 5} />
    {:else if widget.widgetType === 'tag_cloud'}
      <TagCloud title={widget.title} {tags} {context} limit={settings().limit || 20} />
    {:else if widget.widgetType === 'categories'}
      <Categories title={widget.title} {categories} {context} limit={settings().limit || 10} />
    {/if}
  </div>
{/if}
