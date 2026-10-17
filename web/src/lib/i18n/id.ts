import type { Message, MessageKey } from './en'

// Typed against the English keys: a message that is missing, or one that is not in English, fails the type check.
export const id: Record<MessageKey, Message> = {
  // shared
  'common.home': 'Beranda',
  'common.search': 'Cari',
  'common.openMenu': 'Buka menu',
  'common.closeMenu': 'Tutup menu',
  'common.clear': 'Hapus',
  'common.advertisement': 'Iklan',
  'common.menuNavigation': 'Menu navigasi',
  'common.mainMenu': 'Menu utama',
  'pager.previous': 'Sebelumnya',
  'pager.next': 'Berikutnya',
  'date.justNow': 'Baru saja',
  'seo.pageNumber': 'Halaman {n}',

  // home
  'home.featuredAria': 'Berita pilihan',
  'home.latest': 'Berita Terbaru',
  'home.views': '{n} dilihat',
  'home.noWidgets': 'Belum ada widget. Tambahkan di admin pada menu Appearance, lalu Widgets.',

  // single article / static page
  'post.author': 'Penulis:',
  'post.topics': 'Topik',
  'post.related': 'Artikel Terkait',
  'post.comments': { one: '{n} Komentar', other: '{n} Komentar' },
  'post.noComments': 'Belum ada komentar. Jadilah yang pertama!',
  'post.reply': 'Balas',
  'post.replyingTo': 'Membalas {name}',
  'post.cancelReply': 'Batalkan balasan',
  'post.leaveComment': 'Tinggalkan Komentar',
  'post.commentPlaceholder': 'Tulis komentar Anda di sini...',
  'post.nameRequired': 'Nama Lengkap *',
  'post.nameOptional': 'Nama Lengkap (opsional)',
  'post.emailRequired': 'Alamat Email *',
  'post.emailOptional': 'Alamat Email (opsional)',
  'post.remember': 'Simpan nama dan email untuk komentar saya selanjutnya.',
  'post.sending': 'Mengirim...',
  'post.submitComment': 'Kirim Komentar',
  'post.commentSent': 'Komentar berhasil dikirim!',
  'post.commentFailed': 'Gagal',
  'post.copy': 'Salin',
  'post.copied': 'Tersalin!',

  // category and tag pages
  'archive.titleCategory': 'Berita {name}',
  'archive.descriptionCategory': 'Kumpulan berita terbaru seputar {name}.',
  'archive.titleTag': 'Berita tentang {name}',
  'archive.descriptionTag': 'Kumpulan berita terbaru dengan topik {name}.',
  'archive.tag': 'Tag: {name}',
  'archive.count': { one: '{n} artikel', other: '{n} artikel' },
  'archive.emptyCategory': 'Tidak ada artikel dalam kategori ini.',
  'archive.emptyTag': 'Tidak ada artikel untuk tag ini.',
  'archive.sortLatest': 'Terbaru',
  'archive.sortPopular': 'Terpopuler',
  'archive.sortRandom': 'Acak',
  'archive.popular': 'Berita Populer',

  // search page and dialog
  'search.title': 'Pencarian',
  'search.titleQuery': 'Cari: {q}',
  'search.placeholder': 'Cari artikel...',
  'search.button': 'Cari',
  'search.resultsFor': 'Hasil untuk "{q}" ({n} ditemukan)',
  'search.none': 'Tidak ada hasil untuk pencarian ini.',
  'search.dialogTitle': 'Cari artikel',
  'search.minChars': 'Ketik minimal {n} huruf untuk mencari berita.',
  'search.failed': 'Pencarian gagal. Coba lagi sebentar.',
  'search.noResults': 'Tidak ada hasil untuk “{q}”.',
  'search.resultsAria': 'Hasil pencarian',
  'search.viewAll': 'Lihat semua {n} hasil untuk “{q}”',

  // error page
  'error.notFoundTitle': 'Halaman tidak ditemukan',
  'error.generalTitle': 'Terjadi kesalahan',
  'error.notFoundText': 'Alamat yang Anda buka tidak ada, atau halamannya sudah dipindahkan.',
  'error.generalText': 'Maaf, ada masalah di sisi kami. Silakan coba lagi sebentar lagi.',
  'error.backHome': 'Kembali ke beranda',
  'error.searchNews': 'Cari berita',
}
