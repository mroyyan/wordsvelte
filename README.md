# WordSvelte

A modern, full-featured News CMS. Deploy to Cloudflare with one command.

## Tech Stack

- **Frontend**: Svelte 5 + SvelteKit 2
- **Styling**: Tailwind CSS v4 + shadcn-svelte
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Auth**: JWT (jose) + PBKDF2
- **Editor**: CKEditor 5
- **Hosting**: Cloudflare Pages + Workers

## Features

- Posts with categories, tags, featured images
- Static pages (About, Contact, Editorial Guidelines, ...) served at `/<slug>`, addable to any menu, with WordPress page import
- Rich text editor (CKEditor 5)
- Comments with moderation
- Media library with R2 storage
- User management with roles (admin, editor, author)
- Customizable themes (Handlebars)
- Widgets and menus
- RSS feed
- One-click deployment to Cloudflare

---

## Quick Start

```bash
npx wordsvelte
```

CLI akan memandu setup Cloudflare (OAuth login, D1, R2, migration) otomatis. Buka `http://localhost:5173/admin` — setup wizard bikin admin pertama.

---

## Manual Install (alternative)

```bash
git clone https://github.com/mroyyan/wordsvelte.git
cd wordsvelte
npm install
npm run dev -w web
```

---

## Deploy to Cloudflare

Jika sudah login via `npx wordsvelte` atau `wrangler login`:

```bash
npm run deploy -w web
```

Atau setup manual:

```bash
npx wrangler d1 create wordsvelte-db
npx wrangler r2 bucket create wordsvelte-media

# apply every migration, in order (schema first, then default seed data)
for f in web/drizzle/*.sql; do npx wrangler d1 execute wordsvelte-db --remote --file=$f; done

# REQUIRED in production - the app refuses to issue/verify sessions without it (min. 16 chars)
npx wrangler pages secret put JWT_SECRET --project-name wordsvelte-web

npm run deploy -w web
```

Setelah mengubah `shared/src/schema`: `cd web && npx drizzle-kit generate`, commit file SQL baru di `web/drizzle/`, lalu jalankan
file tersebut di D1. Jangan mengubah database lewat kode di runtime.

---

## Project Structure

```
news/
├── shared/                  # Shared package
│   └── src/
│       ├── schema/          # Drizzle ORM schema
│       └── utils/           # toSlug() helper
├── web/                     # Main SvelteKit app
│   ├── src/
│   │   ├── lib/
│   │   │   ├── server/          # server-only code (never shipped to the browser)
│   │   │   │   ├── core/        #   errors, validators, crypto, sanitize: no framework or DB knowledge
│   │   │   │   ├── http/        #   response helpers, CSRF, rate limiters
│   │   │   │   ├── auth/        #   JWT sessions + two-factor primitives (TOTP, secret box, codes)
│   │   │   │   ├── db/          #   database connection (D1 + local SQLite)
│   │   │   │   ├── repositories/ #  all SQL (Drizzle) lives here, one repository per aggregate
│   │   │   │   ├── mail/        #   mailer, SMTP client (Workers sockets / node:net in dev)
│   │   │   │   ├── seo/         #   site info, sitemaps, RSS
│   │   │   │   ├── storage/     #   uploads (R2)
│   │   │   │   ├── themes/      #   Handlebars theme engine
│   │   │   │   └── services/    #   business rules, grouped by domain; no SQL, talks to repositories
│   │   │   │       ├── content/ #     posts, pages, categories, tags, comments, media, public-site read model
│   │   │   │       ├── site/    #     settings, SMTP config, mail, menus, widgets, themes, dashboard, migration
│   │   │   │       └── account/ #     users, profile, sign-in, password reset, two-factor
│   │   │   ├── client/          # browser-side helpers (admin API client, session storage)
│   │   │   ├── shared/          # pure code used by both sides (date formats, SEO helpers)
│   │   │   ├── config/          # navigation and auth page definitions
│   │   │   └── components/
│   │   │       ├── ui/          #   shadcn-svelte
│   │   │       ├── layout/      #   admin shell (sidebar, header)
│   │   │       ├── data-table/  #   shared table
│   │   │       ├── admin/       #   admin forms and editors
│   │   │       ├── auth/        #   sign-in pages
│   │   │       └── site/        #   public site (SEO tags, menus, widgets)
│   │   └── routes/
│   │       ├── api/           # REST API
│   │       └── admin/         # Admin panel
│   ├── themes/                # Theme templates
│   ├── drizzle/               # DB migrations (schema + seed), applied by drizzle migrator locally and wrangler on D1
│   ├── tests/                 # server/ and client/ vitest suites, helpers/ (harness, fake SMTP server)
│   ├── scripts/e2e-smoke.mjs  # end-to-end smoke test
│   └── wrangler.toml          # Cloudflare config
└── package.json               # Root workspace
```

Dependencies run one way: **routes -> services -> repositories -> db**. Routes only translate HTTP (cookies, tokens, throttling, status codes);
services hold the rules; repositories hold the SQL. `tests/server/architecture.test.ts` enforces this (allowed imports per layer, and no Drizzle or table
access outside repositories). Three read-only/bulk modules (dashboard, WordPress import, sitemap) are listed there as known exceptions.

## SEO

Everything below is automatic once **Settings > General > Site URL** is set (leave it empty to use the address of the request).

| What | Where |
|------|-------|
| `<title>`, meta description, canonical URL, `robots` | every public page (`$lib/components/seo.svelte`) |
| Open Graph + Twitter Card (title, description, image, article times/author/section/tags) | every public page; falls back to Settings > SEO defaults |
| JSON-LD: `NewsArticle`, `BreadcrumbList`, `WebSite` (+ sitelinks search box), `NewsMediaOrganization`, `WebPage` | articles, categories/tags, home, static pages |
| `/sitemap.xml` (index) -> `/sitemap-pages.xml`, `/sitemap-posts-N.xml` (1,000 posts each), `/sitemap-news.xml` (last 48 h, Google News) | cached 15 min in the browser, 1 h at the edge |
| `/robots.txt` | blocks `/admin`, `/api/`, `/search`; lists the sitemaps |
| `/rss.xml` + `<link rel="alternate">` | full content, categories, author, `atom:link` |
| `X-Robots-Tag: noindex` | all `/admin` and `/api/` responses |
| Search results and error pages | `noindex` |

"Allow search engines" off => `noindex, nofollow` on every page, `Disallow: /` in robots.txt, empty sitemaps and an empty feed.
After deploying, submit `https://your-site/sitemap.xml` (and the news sitemap) in Google Search Console.

## Roles & Permissions

| Role | Can do |
|------|--------|
| `author` | Create posts, edit/delete **own** posts, upload images, delete own uploads |
| `editor` | Everything an author can, plus: manage **all** posts, feature posts on the front page, categories, tags, **pages**, moderate comments, delete any media |
| `admin` | Everything, plus: users, settings, themes, menus, widgets, WordPress import |

There is no public registration; admins create accounts (`Admin > Users`). The role is always read from the database, so demoting or
deleting a user takes effect immediately, even for tokens that have not expired yet.

## Security Notes

- **Sessions**: HS256 JWT (7 days) in an `httpOnly; SameSite=Lax` cookie or `Authorization: Bearer`. In production `JWT_SECRET` is mandatory.
- **CSRF**: state-changing requests must be same-origin (`Origin`/`Referer`/`Sec-Fetch-Site`); cookie-authenticated requests with no provenance are rejected.
- **Brute force**: logins are throttled per email (5 failures / 15 min) and per IP; public comments are limited to 5/min per IP. These counters are
  per Worker isolate (best effort) - add a Cloudflare Rate Limiting rule on `/api/auth/login` for a hard guarantee.
- **HTML**: post content, excerpts, widgets and imported content are sanitised with an allow-list (`sanitize-html`); comments are plain text and rendered escaped.
- **Uploads**: images only (JPEG/PNG/GIF/WebP/AVIF), type decided from the file's magic bytes, random server-side file names, served with `nosniff` + a sandboxing CSP.
  Theme archives are validated (path traversal, file types, size, template syntax) before anything is written.
- **Two-factor sign-in** (Profile > Two-factor authentication): an authenticator app (TOTP, RFC 6238, replay-protected) and/or a 6-digit email code
  (10 minute expiry, 5 attempts, single use), plus 10 one-time recovery codes. After the password step the browser only receives a short-lived
  *challenge* token that cannot be used as a session. Wrong codes are throttled per account and per IP. Turning a factor off, or making new recovery codes, asks for the password.
- **Session revocation**: changing or resetting a password, or turning 2FA off, bumps the account's `session_version` and signs out every other device.
- **Secrets at rest**: the SMTP password and TOTP seeds are encrypted (AES-256-GCM) with a key derived from `JWT_SECRET`. If you rotate `JWT_SECRET`
  they become unreadable: enter the SMTP password again, and affected users set up their authenticator again (recovery codes still work).
- **Settings**: secrets (e.g. `jwt_secret`, `smtp_*`) are never returned by any API or page and cannot be written through the settings API.
- Not covered: a Content-Security-Policy for the admin UI (CKEditor needs inline styles), and sandboxing of uploaded Handlebars themes
  (only admins can install themes - treat a theme like code).

## Testing

```bash
npm test                      # unit + API integration tests (vitest, in-memory SQLite with the real migrations)

# end-to-end against the real Cloudflare runtime (workerd + local D1/R2)
cd web && npx vite build
rm -rf .wrangler/e2e && for f in drizzle/*.sql; do npx wrangler d1 execute wordsvelte-db --local --persist-to .wrangler/e2e --file=$f; done
npx wrangler pages dev .svelte-kit/cloudflare --persist-to .wrangler/e2e --port 8799 --binding JWT_SECRET=local-e2e-secret-123456
node scripts/e2e-smoke.mjs http://127.0.0.1:8799     # needs a fresh database
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Production | JWT signing secret, min. 16 chars (`wrangler pages secret put JWT_SECRET`). The app fails closed without it |
| `DB` | Auto | D1 database binding |
| `R2` | Auto | R2 bucket binding |
| `RESEND_API_KEY`, `MAIL_FROM` | Optional | Sends mail (password resets, sign-in codes) through [Resend](https://resend.com) when no SMTP server is configured in **Settings > Email** |

**Email**: configure an SMTP server in *Settings > Email* (host, port, STARTTLS or SSL/TLS, login, from address) and use *Send test* to check it. SMTP wins over
`RESEND_API_KEY`. On Cloudflare the connection uses Workers TCP sockets, so use port **587** or **465** (port 25 is blocked by Cloudflare). Without any
mail provider, password resets and email codes cannot be delivered in production (in dev they are printed to the terminal); authenticator-app codes and recovery codes still work.
| `WORDSVELTE_LOCAL_DB` | No | Dev only: path of the local SQLite file (default `web/.local.db/portal.db`) |

In development (`npm run dev`), a JWT secret is auto-generated and kept in the local SQLite database and migrations are applied automatically. No `.env` file needed.

> **Upgrading an old dev database**: databases created before versioned migrations are rejected with a clear error. Delete `web/.local.db/` and restart.

## License

MIT
