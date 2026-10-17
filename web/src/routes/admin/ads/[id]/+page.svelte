<script lang="ts">
  import { page } from '$app/stores'
  import AdForm from '$lib/components/admin/ad-form.svelte'

  const id = $derived(Number($page.params.id))
</script>

{#key id}<AdForm adId={id} />{/key}
