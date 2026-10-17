<script lang="ts">
  import { t } from '$lib/i18n'
  import { page } from '$app/stores'
  import type { AdPlacement } from '@wordsvelte/shared'
  import { deviceClass, type AdsByPlacement } from '$lib/shared/ads'
  import { cn } from '$lib/utils'

  let { placement, class: className }: { placement: AdPlacement; class?: string } = $props()

  const ads = $derived((($page.data.ads ?? {}) as AdsByPlacement)[placement] ?? [])

  /**
   * Ad networks hand out <script> snippets. Markup inserted with innerHTML never runs its scripts, so each one is
   * replaced by a fresh element, which the browser does execute. Runs in the browser only, like the networks themselves.
   */
  function injectCode(node: HTMLElement, code: string) {
    const render = (html: string) => {
      node.innerHTML = html
      for (const old of Array.from(node.querySelectorAll('script'))) {
        const fresh = document.createElement('script')
        for (const attr of Array.from(old.attributes)) fresh.setAttribute(attr.name, attr.value)
        fresh.text = old.textContent ?? ''
        old.replaceWith(fresh)
      }
    }
    render(code)
    return { update: render }
  }
</script>

{#each ads as ad (ad.id)}
  <aside class={cn('ad-slot', deviceClass(ad.devices), className)} data-ad-placement={placement} aria-label={t('common.advertisement')}>
    <p class="mb-1 text-center text-[10px] font-medium uppercase tracking-widest text-gray-400">{t('common.advertisement')}</p>
    {#if ad.type === 'banner' && ad.imageUrl && ad.href}
      <a href={ad.href} target="_blank" rel="sponsored nofollow noopener" class="block">
        <img src={ad.imageUrl} alt={ad.altText ?? ''} loading="lazy" class="mx-auto h-auto max-w-full" />
      </a>
    {:else if ad.code}
      <div class="flex justify-center overflow-hidden" use:injectCode={ad.code}></div>
    {/if}
  </aside>
{/each}
