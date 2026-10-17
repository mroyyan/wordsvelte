# WordSvelte (Bahasa Indonesia)

CMS berita untuk Cloudflare (Pages, D1, R2) berbasis SvelteKit. Dokumentasi lengkap (bahasa Inggris) ada di [README.md](README.md).

## Mulai cepat

```bash
npx wordsvelte
```

CLI memandu setup Cloudflare (login OAuth, database D1, bucket R2, migrasi). Lalu buka `http://localhost:5173/admin`: halaman setup
membuat admin pertama.

## Instal manual

```bash
git clone https://github.com/mroyyan/wordsvelte.git
cd wordsvelte
npm install
npm run dev
```

Buka `http://localhost:5173/admin/setup` untuk membuat admin pertama. Saat development, JWT secret dibuat otomatis dan migrasi dijalankan
otomatis; tidak perlu file `.env`.

## Deploy ke Cloudflare

Kalau sudah login lewat `npx wordsvelte` atau `wrangler login`:

```bash
npm run deploy
```

Atau manual:

```bash
npx wrangler d1 create wordsvelte-db
npx wrangler r2 bucket create wordsvelte-media
```

`wrangler d1 create` mencetak `database_id`. Tempel ke `web/wrangler.toml` (isinya sekarang placeholder `local-dev`), lalu:

```bash
# jalankan semua migrasi berurutan
for f in web/drizzle/*.sql; do npx wrangler d1 execute wordsvelte-db --remote --file=$f; done

# WAJIB di production (minimal 16 karakter)
npx wrangler pages secret put JWT_SECRET --project-name wordsvelte-web

npm run deploy
```

**Memperbarui versi**: tarik versi baru, jalankan file migrasi yang baru sejak deploy terakhir (daftarnya ada di [CHANGELOG.md](CHANGELOG.md);
file-nya ada di `web/drizzle/`), lalu deploy lagi. Migrasi hanya menambah; database tidak pernah diubah oleh kode saat berjalan.
