<script lang="ts">
  import { page } from '$app/state'
  import { Button } from '$lib/components/ui/button'
  import { tr } from '$lib/i18n/admin'

  const status = $derived(page.status)
  const title = $derived(
    status === 404 ? tr('Oops! Page Not Found!')
    : status === 403 ? tr('Access Forbidden')
    : status === 401 ? tr('Unauthorized Access')
    : tr('Oops! Something went wrong')
  )
  const body = $derived(
    status === 404 ? tr('It seems like the page you are looking for does not exist or might have been removed.')
    : status === 403 ? tr('You do not have the necessary permission to view this resource.')
    : status === 401 ? tr('Please sign in with the right credentials to view this resource.')
    : tr('We apologize for the inconvenience. Please try again later.')
  )
</script>

<svelte:head><title>{status} - {title}</title></svelte:head>

<div class="flex min-h-[70svh] w-full flex-col items-center justify-center gap-2 text-center">
  <h1 class="text-[7rem] leading-tight font-bold">{status}</h1>
  <span class="font-medium">{title}</span>
  <p class="max-w-md text-muted-foreground">{body}</p>
  <div class="mt-6 flex gap-4">
    <Button variant="outline" onclick={() => history.back()}>{tr('Go Back')}</Button>
    <Button href="/admin">{tr('Back to Home')}</Button>
  </div>
</div>
