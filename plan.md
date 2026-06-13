# Migrasi Portal Berita — WordPress → Hono + SvelteKit + D1 + R2

## Arsitektur

```
┌─ Cloudflare ──────────────────────────────────────────────────────┐
│                                                                   │
│  kubus.id              api.kubus.id          redaksi.kubus.id     │
│  (Pages SSR)           (Worker)              (Pages SPA)          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐      │
│  │ SvelteKit     │     │ Hono          │     │ React+Vite    │      │
│  │ adapter-cf    │     │ Drizzle       │     │ shadcn-admin  │      │
│  │ Tailwind      │     │ Zod           │     │ JWT client    │      │
│  └──────┬────────┘     └──────┬────────┘     └──────┬────────┘      │
│         │                     │                     │               │
│  read D1 langsung     write + auth JWT      CRUD via API            │
│  (SSR, 1 invokasi)     (write-heavy)        (Bearer JWT)            │
│         │                     │                     │               │
│         ▼                     ▼                     ▼               │
│  ┌──────────────┐     ┌──────────────┐                             │
│  │  D1 Database  │     │  R2 Storage  │                             │
│  │  (SQLite)     │     │  (images)    │                             │
│  └──────────────┘     └──────────────┘                             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Alur Data

| Skenario | Read | Write | Invokasi |
|----------|------|-------|----------|
| Publik lihat artikel | SvelteKit → D1 langsung | - | 1x (SSR) |
| Publik cari artikel | SvelteKit → D1 langsung | - | 1x (SSR) |
| Publik komentar | - | SvelteKit → `api.kubus.id` | 1x (API) |
| Admin login | - | `api.kubus.id` → D1 | 1x (API) |
| Admin CRUD post | `api.kubus.id` → D1 | `api.kubus.id` → D1 | 1x (API) |
| Admin upload media | - | `api.kubus.id` → R2 + D1 | 1x (API) |

### Domain Mapping

| Domain | Framework | Hosting | Type |
|--------|-----------|---------|------|
| `kubus.id` | SvelteKit + Tailwind | Cloudflare Pages | SSR |
| `api.kubus.id` | Hono + Drizzle | Cloudflare Worker | REST API |
| `redaksi.kubus.id` | React + Vite + shadcn-admin | Cloudflare Pages | Static SPA |

---

## Teknologi

| Layer | Stack |
|-------|-------|
| API Framework | Hono (Cloudflare Worker) |
| Database | D1 (SQLite) + Drizzle ORM |
| Storage | R2 (S3-compatible) |
| Public Frontend | SvelteKit + adapter-cloudflare + Tailwind CSS |
| Admin Frontend | React + Vite + shadcn-admin |
| Auth | JWT (bcrypt + jsonwebtoken) |
| Validasi | Zod (shared schema api ↔ admin) |
| Rich Text | Tiptap (admin editor) |
| Monorepo | npm workspaces |

---

## Struktur Proyek

```
news/
├── plan.md
├── package.json              # root workspace
├── schema.sql                # D1 DDL (untuk wrangler d1 execute)
├── wrangler.toml             # root wrangler config
│
├── shared/                   # Shared types & schema (npm workspace)
│   ├── package.json
│   └── src/
│       ├── index.ts
│       ├── db-schema.ts      # Drizzle schema
│       └── api-types.ts      # Zod validation + TypeScript types
│
├── api/                      # Hono backend (Cloudflare Worker)
│   ├── package.json
│   ├── wrangler.toml
│   └── src/
│       ├── index.ts          # Hono app init
│       ├── lib/
│       │   ├── db.ts         # Drizzle client
│       │   ├── jwt.ts        # JWT helpers
│       │   └── r2.ts         # R2 helpers
│       ├── middleware/
│       │   └── auth.ts       # JWT verify middleware
│       └── routes/
│           ├── auth.ts
│           ├── posts.ts
│           ├── categories.ts
│           ├── tags.ts
│           ├── comments.ts
│           ├── media.ts
│           └── settings.ts
│
├── web/                      # SvelteKit publik
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts
│   └── src/
│       ├── app.html
│       ├── app.css           # Tailwind base
│       ├── hooks.server.ts   # CF platform env
│       ├── lib/
│       │   ├── db.ts         # D1 Drizzle client (via platform.env.DB)
│       │   └── utils.ts
│       └── routes/
│           ├── +page.svelte          # Homepage
│           ├── +page.server.ts       # Homepage loader (D1)
│           ├── post/
│           │   └── [slug]/
│           │       ├── +page.svelte
│           │       └── +page.server.ts
│           ├── kategori/
│           │   └── [slug]/
│           │       ├── +page.svelte
│           │       └── +page.server.ts
│           ├── search/
│           │   ├── +page.svelte
│           │   └── +page.server.ts
│           └── rss.xml/
│               └── +server.ts
│
├── admin/                    # React admin dashboard
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/              # API client (auth: Bearer JWT)
│       │   ├── client.ts
│       │   ├── auth.ts
│       │   ├── posts.ts
│       │   ├── categories.ts
│       │   ├── tags.ts
│       │   ├── media.ts
│       │   └── settings.ts
│       ├── hooks/
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── Posts/
│       │   ├── Categories/
│       │   ├── Tags/
│       │   ├── Media/
│       │   └── Settings.tsx
│       └── components/
│           └── ui/           # shadcn components
│
├── scripts/                  # Utilitas
│   ├── package.json
│   └── migrate-wp.js         # Import WordPress WXR → D1 + R2
│
└── .gitignore
```

---

## ERD — D1 Database

### Tables

```
USERS
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── email           TEXT UNIQUE NOT NULL
├── username        TEXT UNIQUE NOT NULL
├── password_hash   TEXT NOT NULL
├── display_name    TEXT NOT NULL
├── role            TEXT NOT NULL DEFAULT 'author'  -- admin|editor|author
├── avatar_url      TEXT
├── created_at      TEXT NOT NULL DEFAULT (datetime('now'))
└── updated_at      TEXT NOT NULL DEFAULT (datetime('now'))

POSTS
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── author_id       INTEGER NOT NULL REFERENCES users(id)
├── title           TEXT NOT NULL
├── slug            TEXT UNIQUE NOT NULL
├── excerpt         TEXT
├── content         TEXT NOT NULL
├── status          TEXT NOT NULL DEFAULT 'draft'  -- draft|publish|trash
├── featured_image_url  TEXT
├── view_count      INTEGER NOT NULL DEFAULT 0
├── created_at      TEXT NOT NULL DEFAULT (datetime('now'))
├── updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
└── published_at    TEXT

POST_META
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE
├── key             TEXT NOT NULL
├── value           TEXT NOT NULL
└── UNIQUE(post_id, key)

CATEGORIES
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── name            TEXT NOT NULL
├── slug            TEXT UNIQUE NOT NULL
├── description     TEXT
├── parent_id       INTEGER REFERENCES categories(id)
└── created_at      TEXT NOT NULL DEFAULT (datetime('now'))

TAGS
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── name            TEXT NOT NULL
├── slug            TEXT UNIQUE NOT NULL
└── created_at      TEXT NOT NULL DEFAULT (datetime('now'))

POST_CATEGORIES
├── post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE
├── category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE
└── PRIMARY KEY (post_id, category_id)

POST_TAGS
├── post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE
├── tag_id          INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE
└── PRIMARY KEY (post_id, tag_id)

MEDIA
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── r2_key          TEXT NOT NULL              -- path di R2: YYYY/MM/filename
├── original_name   TEXT NOT NULL
├── mime_type       TEXT NOT NULL
├── size            INTEGER NOT NULL           -- bytes
├── width           INTEGER
├── height          INTEGER
├── alt_text        TEXT
├── caption         TEXT
├── uploaded_by     INTEGER NOT NULL REFERENCES users(id)
└── created_at      TEXT NOT NULL DEFAULT (datetime('now'))

COMMENTS
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── post_id         INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE
├── author_name     TEXT NOT NULL
├── author_email    TEXT NOT NULL
├── content         TEXT NOT NULL
├── status          TEXT NOT NULL DEFAULT 'pending'  -- approved|pending|spam|trash
├── parent_id       INTEGER REFERENCES comments(id)
├── created_at      TEXT NOT NULL DEFAULT (datetime('now'))

SETTINGS
├── key             TEXT PRIMARY KEY
└── value           TEXT NOT NULL

SESSIONS
├── id              TEXT PRIMARY KEY           -- session token
├── user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
├── expires_at      TEXT NOT NULL
└── created_at      TEXT NOT NULL DEFAULT (datetime('now'))
```

### Indexes

```sql
CREATE INDEX idx_posts_slug ON posts(slug);
CREATE INDEX idx_posts_status_published ON posts(status, published_at);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_media_uploader ON media(uploaded_by);
CREATE INDEX idx_post_meta_post ON post_meta(post_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_tags_slug ON tags(slug);
```

### Full-Text Search (FTS5)

```sql
CREATE VIRTUAL TABLE posts_fts USING fts5(
  title, excerpt, content,
  content=posts, content_rowid=id
);

-- Triggers untuk sinkronisasi
CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, excerpt, content)
  VALUES (new.id, new.title, new.excerpt, new.content);
END;

CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, excerpt, content)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content);
END;

CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, excerpt, content)
  VALUES ('delete', old.id, old.title, old.excerpt, old.content);
  INSERT INTO posts_fts(rowid, title, excerpt, content)
  VALUES (new.id, new.title, new.excerpt, new.content);
END;
```

---

## R2 Storage Structure

```
media/
├── {YYYY}/
│   └── {MM}/
│       ├── {filename}.{ext}          -- original
│       └── thumb/
│           ├── {filename}-sm.{ext}   -- 150x150
│           └── {filename}-md.{ext}   -- 768xauto
└── ...
```

Buat public access, R2 bucket di-set public + custom domain `media.kubus.id` atau via `r2.dev` bawaan.

---

## API Endpoints (Hono)

### Public (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/posts` | List published posts (paginated) |
| GET | `/api/posts/:slug` | Single post detail |
| GET | `/api/categories` | List all categories |
| GET | `/api/categories/:slug` | Single category + posts count |
| GET | `/api/tags` | List all tags |
| GET | `/api/posts/:id/comments` | Approved comments for a post |
| POST | `/api/comments` | Submit comment (captcha optional) |
| GET | `/api/settings` | Public site settings |
| GET | `/api/search?q=...` | Full-text search |

### Protected (JWT required — admin)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Current user info |
| POST | `/api/posts` | Create post |
| PUT | `/api/posts/:id` | Update post |
| DELETE | `/api/posts/:id` | Delete post |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |
| POST | `/api/tags` | Create tag |
| PUT | `/api/tags/:id` | Update tag |
| DELETE | `/api/tags/:id` | Delete tag |
| GET | `/api/comments` | List all comments (moderation) |
| DELETE | `/api/comments/:id` | Delete comment |
| PATCH | `/api/comments/:id/status` | Approve/spam/trash comment |
| POST | `/api/media` | Upload file |
| GET | `/api/media` | List media |
| DELETE | `/api/media/:id` | Delete media |
| PUT | `/api/settings` | Update settings |
| POST | `/api/users` | Create user |
| GET | `/api/users` | List users |
| PUT | `/api/users/:id` | Update user |

---

## Tahapan Implementasi

### Phase 1 — Foundasi (estimasi: 1 hari)

1. Init monorepo + npm workspaces (shared, api, web, admin, scripts)
2. Setup shared package: Drizzle schema + Zod validasi + TypeScript types
3. Buat `schema.sql` — DDL D1
4. Setup api: Hono + Drizzle + wrangler.toml
5. Setup web: SvelteKit + adapter-cloudflare + Tailwind
6. Setup admin: React + Vite + shadcn-ui
7. Setup wrangler.toml root (bindings D1 + R2)

### Phase 2 — Backend API (estimasi: 2 hari)

1. Auth: register, login, JWT, middleware
2. CRUD posts + slugs otomatis
3. CRUD categories (hierarki with parent_id)
4. CRUD tags
5. Comments: submit + moderasi
6. Media: upload ke R2, generate thumbnail via Worker, delete
7. Settings: key-value
8. Search: FTS5 query
9. Public read endpoints (list, detail, filter by category/tag)

### Phase 3 — Public Frontend (estimasi: 2 hari)

1. Layout: header (nav categories), footer, responsive
2. Homepage: featured slider + list artikel (paginated, infinite scroll)
3. Artikel detail: content (render HTML safe), author, tanggal, komentar
4. Kategori page: artikel by kategori
5. Tag page: artikel by tag
6. Search page: input + results
7. RSS feed
8. SEO: meta tags, Open Graph, sitemap
9. Caching: Cache-Control + CF edge cache

### Phase 4 — Admin Dashboard (estimasi: 3 hari)

1. Setup shadcn-ui components + theming
2. Login page (JWT storage + redirect)
3. Dashboard: stat card (total posts, comments pending, recent posts)
4. Posts: datatable + create/edit form (Tiptap editor) + featured image picker
5. Categories: tree/hierarchy management
6. Tags: simple CRUD
7. Media: grid uploader + drag & drop + delete
8. Comments: moderation queue
9. Settings: site name, description, logo
10. Users: list + role management

### Phase 5 — WordPress Migration (estimasi: 2 hari)

1. Export WXR dari WordPress
2. Parse WXR: posts, pages → posts; categories, tags → taxonomy; comments; media
3. Download media dari `wp-content/uploads/` → upload ke R2
4. Transform data + insert ke D1 (via script atau direct API)
5. Validasi: count match + spot check URLs
6. Redirect mapping: old WP permalink → new slug (301)

### Phase 6 — Deployment & Optimasi (estimasi: 1 hari)

1. Deploy Hono Worker: `wrangler deploy`
2. Deploy SvelteKit Pages: `wrangler pages deploy`
3. Deploy Admin Pages: `wrangler pages deploy`
4. Setup custom domain + SSL
5. Konfigurasi cache + headers (security, CORS)
6. Test performa + Lighthouse
7. Setup monitoring (CF Analytics)

---

## Catatan Free Tier Cloudflare

| Aspek | Limit Free | Estimasi Kebutuhan |
|-------|-----------|-------------------|
| Workers / Pages Functions | 100k req/hari | Publik ~10k-30k views/hari + admin ~1k → aman |
| D1 Storage | 5 GB | 5000 post + meta + komentar < 500 MB → aman |
| D1 Read Rows | 10M/bulan | ~300k/hari → perlu cache aggressive |
| D1 Write Rows | 1M/bulan | Admin ops → aman |
| R2 Storage | 10 GB | Tergantung gambar; kalau rata-rata 200KB/gambar → ~50k gambar |
| R2 Class A | 10M/bulan | Upload/delete → aman |
| R2 Class B | 100M/bulan | GET images → tinggi, pakai CF cache! |
| Pages Bandwidth | 100 GB/bulan | Aman untuk portal berita tier awal |
| Pages Build | 500/minggu | ~70/hari → aman |

### Strategi Hemat Free Tier

1. **Cache aggressive**: Set `Cache-Control: public, max-age=300` di artikel → kurangi D1 reads 10x lipat
2. **Images via CF**: Serve R2 images melalui `cf-images` atau `cf-cache` biar ga kena R2 class B per request
3. **SSR langsung D1**: SvelteKit baca D1 langsung tanpa lewat API → 1 invokasi, bukan 2
4. **Pagination**: Maksimal 20 post per page → kurangi row reads
5. **No expensive queries**: Hindari JOIN besar, pake counter cache (view_count di tabel posts)
