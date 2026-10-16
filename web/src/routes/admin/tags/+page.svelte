<script lang="ts">
  import TaxonomyManager from '$lib/components/admin/taxonomy-manager.svelte'
</script>

<TaxonomyManager endpoint="/api/tags" singular="Tag" plural="Tags" subtitle="Label and group related posts" />
