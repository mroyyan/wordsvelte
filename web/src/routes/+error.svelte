<script lang="ts">
  import { page } from '$app/state'

  const status = $derived(page.status)
  const notFound = $derived(status === 404)
  const heading = $derived(notFound ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan')
  const body = $derived(notFound
    ? 'Alamat yang Anda buka tidak ada, atau halamannya sudah dipindahkan.'
    : 'Maaf, ada masalah di sisi kami. Silakan coba lagi sebentar lagi.')
</script>

<svelte:head>
  <title>{status} - {heading}</title>
  <!-- error pages must never be indexed -->
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-16 text-center">
  <p class="text-6xl font-bold tracking-tight text-gray-300">{status}</p>
  <h1 class="text-2xl font-semibold text-gray-900">{heading}</h1>
  <p class="text-gray-600">{body}</p>
  <div class="mt-2 flex flex-wrap justify-center gap-3">
    <a href="/" class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Kembali ke beranda</a>
    <a href="/search" class="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cari berita</a>
  </div>
</div>
