<script lang="ts">
  import TaxonomyManager from '$lib/components/admin/taxonomy-manager.svelte'
</script>

<TaxonomyManager endpoint="/api/categories" singular="Category" plural="Categories" subtitle="Organize content" withDescription />
