<script lang="ts">
  import { t } from '$lib/i18n'
  import { page } from '$app/state'

  const status = $derived(page.status)
  const notFound = $derived(status === 404)
  const heading = $derived(notFound ? t('error.notFoundTitle') : t('error.generalTitle'))
  const body = $derived(notFound
    ? t('error.notFoundText')
    : t('error.generalText'))
</script>

<svelte:head>
  <title>{status} - {heading}</title>
  <!-- error pages must never be indexed -->
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-2 px-4 py-16 text-center">
  <h1 class="text-[7rem] leading-tight font-bold text-gray-900">{status}</h1>
  <span class="font-medium text-gray-900">{heading}</span>
  <p class="text-gray-500">{body}</p>
  <div class="mt-6 flex flex-wrap justify-center gap-4">
    <a href="/search" class="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">{t('error.searchNews')}</a>
    <a href="/" class="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">{t('error.backHome')}</a>
  </div>
</div>
