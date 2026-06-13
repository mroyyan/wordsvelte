# Kubus News

Portal berita — migrasi dari WordPress ke **Hono** + **SvelteKit** + **D1** + **R2**.

## Stack

| Layer | Tech | Deploy |
|-------|------|--------|
| API | Hono + Drizzle ORM | Cloudflare Worker → `api.kubus.id` |
| Public | SvelteKit (SSR) + Tailwind + DaisyUI | Cloudflare Pages → `kubus.id` |
| Admin | React + Vite + shadcn-admin | Cloudflare Pages → `redaksi.kubus.id` |
| DB | D1 (SQLite via Drizzle) | Cloudflare D1 |
| Storage | R2 (S3-compatible) | Cloudflare R2 |
| Auth | JWT | `api.kubus.id/auth` |

## Struktur

```
news/
├── api/          Hono Worker
├── web/          SvelteKit publik
├── admin/        React SPA (shadcn-admin)
├── shared/       Drizzle schema + Zod validasi (npm workspace)
├── scripts/      WordPress migration
├── schema.sql    D1 DDL
├── seed.sql      Admin user + default settings
└── plan.md       ERD + implementation plan
```

---

## Prasyarat

- Node.js >= 18
- npm
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)

---

## Setup Lokal

### 1. Install dependencies

```bash
cd news
npm install
```

### 2. Setup D1 lokal

```bash
cd api

# Apply schema (bikin 12 tabel + FTS5 + indexes)
npx wrangler d1 execute kubus-db --local --file=../schema.sql

# Seed admin + default settings
npx wrangler d1 execute kubus-db --local --file=../seed.sql
```

### 3. Set environment

```bash
# Admin — pake API local
echo "VITE_API_URL=http://localhost:8787" > admin/.env

# Web — pake API local
echo "PUBLIC_API_URL=http://localhost:8787" > web/.env
```

File `.env` udah disediakan — tinggal edit kalo port-nya beda.

### 4. Jalankan (3 terminal terpisah)

```bash
# Terminal 1 — API (http://localhost:8787)
npm run dev -w api

# Terminal 2 — Public (http://localhost:5173)
npm run dev -w web

# Terminal 3 — Admin (http://localhost:5174)
npm run dev -w admin
```

Atau langsung dari masing-masing directory:

```bash
cd api    && npm run dev    # → localhost:8787
cd web    && npm run dev    # → localhost:5173
cd admin  && npm run dev    # → localhost:5174
```

---

## Login Admin

| Email | Password | Role |
|-------|----------|------|
| `admin@kubus.id` | `admin123` | admin |

Login via `http://localhost:5174/sign-in`.

---

## API Endpoints

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/posts` | List published posts (paginated) |
| GET | `/api/posts/:slug` | Single post + categories + tags |
| GET | `/api/categories` | All categories |
| GET | `/api/tags` | All tags |
| GET | `/api/posts/:id/comments` | Approved comments |
| POST | `/api/comments` | Submit comment |
| GET | `/api/settings` | Site settings |
| GET | `/api/search?q=...` | Search posts |

### Protected (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → JWT token |
| GET | `/api/auth/me` | Current user info |
| CRUD | `/api/posts` | Manage posts |
| CRUD | `/api/categories` | Manage categories |
| CRUD | `/api/tags` | Manage tags |
| CRUD | `/api/media` | Upload/manage files (R2) |
| PATCH | `/api/comments/:id/status` | Moderate comments |
| PUT | `/api/settings` | Update settings |

---

## Deploy ke Cloudflare

```bash
# 1. Login
npx wrangler login

# 2. Buat D1 production
npx wrangler d1 create kubus-db
# → copy database_id ke api/wrangler.toml + web/wrangler.toml

# 3. Apply schema + seed ke remote
npx wrangler d1 execute kubus-db --remote --file=../schema.sql
npx wrangler d1 execute kubus-db --remote --file=../seed.sql

# 4. Buat R2 bucket
npx wrangler r2 bucket create kubus-media

# 5. Deploy
cd api && npx wrangler deploy              # api.kubus.id
cd web && npm run build && npx wrangler pages deploy .svelte-kit/cloudflare  # kubus.id
cd admin && npm run build && npx wrangler pages deploy dist  # redaksi.kubus.id
```

---

## Arsitektur

```
User → kubus.id (SvelteKit SSR)
        ├─ SSR: baca D1 langsung via platform.env.DB → 1 invokasi
        ├─ Images: dari R2
        └─ Komentar: POST ke api.kubus.id

Admin → redaksi.kubus.id (React SPA)
        ├─ Login → api.kubus.id/auth/login → JWT
        ├─ CRUD → api.kubus.id (Bearer JWT)
        └─ Upload → api.kubus.id/media → R2
```

**Alur data publik (1 invokasi):** User → Cloudflare Pages → SvelteKit SSR → D1 → HTML

**Alur data admin (1 invokasi):** Admin SPA → `api.kubus.id` Worker → D1/R2 → JSON

---

## Migrasi dari WordPress

1. Export WXR dari WordPress (`Tools → Export → All Content`)
2. Taruh file `.xml` di `scripts/`
3. Download folder `wp-content/uploads/`
4. Upload media ke R2 via script
5. Jalankan `node scripts/migrate-wp.js`

(Lihat `scripts/package.json` untuk dependensi)
