# WordSvelte

A news CMS for [Cloudflare](https://www.cloudflare.com/) (Pages, D1 and R2), built with SvelteKit. Write and schedule articles, manage ads, menus and
widgets, and get the SEO a news site needs (sitemaps, Google News sitemap, JSON-LD, RSS) without running a server.

> **Status: early (0.x).** It is used and tested (see [Testing](#testing)), but the API and database schema can still change between minor
> versions. Read the [changelog](CHANGELOG.md) before upgrading: it says when a new database migration has to be applied.

## Features

- **Writing**: posts with categories, tags and featured images; rich text editor (CKEditor 5); **scheduled publishing** in the site timezone; static pages (About, Contact, ...)
- **Public site**: themes (Handlebars), configurable menus and widgets, live search, hero with featured stories, comments with moderation, mobile-friendly layout, interface in Indonesian or English (Settings > General > Language)
- **Ads**: banners and ad-network code (AdSense and others) in eight placements, with run dates, device targeting, click counting and `ads.txt`
- **SEO**: canonical URLs, Open Graph / Twitter cards, JSON-LD, sitemaps (including Google News), editable `robots.txt`, RSS (full text or summary)
- **Admin**: dashboard, media library on R2, users with roles (admin, editor, author), settings, WordPress import
- **Security**: two-factor sign-in (authenticator app or email code), SMTP settings with encrypted password, CSRF protection, rate limiting (details [below](#security-notes))

## Requirements

- Node.js 20 or newer
- A Cloudflare account to deploy (the free plan is enough to start). Local development needs nothing but Node.

## Quick start

```bash
npx wordsvelte
```

The CLI walks you through the Cloudflare setup (login, D1 database, R2 bucket, migrations). Then open `http://localhost:5173/admin`:
the setup page creates the first administrator.

## Manual install

```bash
git clone https://github.com/mroyyan/wordsvelte.git
cd wordsvelte
npm install
npm run dev
```

Open `http://localhost:5173/admin/setup` to create the first administrator. In development a JWT secret is generated and kept in the local
SQLite database, and migrations are applied automatically on start: no `.env` file is needed.

## Deploy to Cloudflare

If you already ran `npx wordsvelte` (or `wrangler login`):

```bash
npm run deploy
```

Or set everything up by hand:

```bash
npx wrangler d1 create wordsvelte-db
npx wrangler r2 bucket create wordsvelte-media
```

`wrangler d1 create` prints a `database_id`. Put it in `web/wrangler.toml` (it holds the placeholder `local-dev`), then:

```bash
# apply every migration in order (schema first, then default data)
for f in web/drizzle/*.sql; do npx wrangler d1 execute wordsvelte-db --remote --file=$f; done

# REQUIRED: the app refuses to issue or verify sessions without it (at least 16 characters)
npx wrangler pages secret put JWT_SECRET --project-name wordsvelte-web

npm run deploy
```

**Upgrading**: pull the new version, run the migration files that are new since your last deploy (the changelog lists them; they are the new files
in `web/drizzle/`), then deploy again. Migrations only ever add; the database is never changed by code at runtime.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Production | Signing secret, at least 16 characters (`wrangler pages secret put JWT_SECRET`). The app fails closed without it |
| `DB`, `R2` | Auto | The D1 and R2 bindings from `web/wrangler.toml` |
| `RESEND_API_KEY`, `MAIL_FROM` | Optional | Sends mail (password resets, sign-in codes) through [Resend](https://resend.com) when no SMTP server is set in **Settings > Email** |
| `WORDSVELTE_LOCAL_DB` | No | Development only: path of the local SQLite file (default `web/.local.db/portal.db`) |

**Email**: set an SMTP server under *Settings > Email* (host, port, STARTTLS or SSL/TLS, login, from address) and use *Send test*. SMTP wins over
`RESEND_API_KEY`. On Cloudflare the connection uses Workers TCP sockets, so use port **587** or **465** (Cloudflare blocks port 25). With no mail
provider, password resets and email codes cannot be delivered in production (in development they are printed to the terminal); authenticator-app
and recovery codes still work.

> **Old development databases**: a local database created before versioned migrations is rejected with a clear error. Delete `web/.local.db/` and restart.

## Project structure

```
├── shared/                  # shared package: Drizzle schema, slug helper
├── packages/wordsvelte/     # the `npx wordsvelte` installer
└── web/                     # the SvelteKit app
    ├── src/
    │   ├── lib/
    │   │   ├── server/          # server-only code (never shipped to the browser)
    │   │   │   ├── core/        #   errors, validators, crypto, sanitize: no framework or DB knowledge
    │   │   │   ├── http/        #   response helpers, CSRF, rate limiters
    │   │   │   ├── auth/        #   JWT sessions + two-factor primitives (TOTP, secret box, codes)
    │   │   │   ├── db/          #   database connection (D1 + local SQLite)
    │   │   │   ├── repositories/ #  all SQL (Drizzle) lives here, one repository per aggregate
    │   │   │   ├── mail/        #   mailer, SMTP client (Workers sockets / node:net in dev)
    │   │   │   ├── seo/         #   site info, sitemaps, RSS
    │   │   │   ├── storage/     #   uploads (R2)
    │   │   │   ├── themes/      #   Handlebars theme engine
    │   │   │   └── services/    #   business rules by domain (content, site, account); no SQL
    │   │   ├── client/          # browser-side helpers (admin API client, session storage)
    │   │   ├── shared/          # pure code used by both sides (date formats, SEO helpers)
    │   │   ├── config/          # navigation, settings sections, ads placements
    │   │   └── components/      # ui (shadcn-svelte), layout, data-table, admin, auth, site
    │   └── routes/              # api/ (REST), admin/ (panel), and the public site
    ├── themes/                  # theme templates
    ├── drizzle/                 # database migrations (SQL), applied by the drizzle migrator locally and by wrangler on D1
    ├── tests/                   # server/ and client/ suites, helpers/ (harness, fake SMTP server)
    └── scripts/e2e-smoke.mjs    # end-to-end smoke test against workerd
```

Dependencies run one way: **routes -> services -> repositories -> db**. Routes only translate HTTP (cookies, tokens, throttling, status codes), services
hold the rules, repositories hold the SQL. `web/tests/server/architecture.test.ts` enforces this (allowed imports per layer, and no Drizzle or table
access outside repositories). Three read-only or bulk modules (dashboard, WordPress import, sitemap) are listed there as known exceptions.

After changing `shared/src/schema`: `cd web && npx drizzle-kit generate`, commit the new SQL file in `web/drizzle/`, and run it on D1.

## SEO

Automatic once **Settings > General > Site URL** is set (leave it empty to use the address of the request).

| What | Where |
|------|-------|
| `<title>`, meta description, canonical URL, `robots` | every public page |
| Open Graph + Twitter Card (title, description, image, article times, author, section, tags) | every public page; falls back to Settings > SEO defaults |
| JSON-LD: `NewsArticle`, `BreadcrumbList`, `WebSite` (with sitelinks search box), `NewsMediaOrganization`, `WebPage` | articles, categories and tags, home, static pages |
| `/sitemap.xml` (index) -> `/sitemap-pages.xml`, `/sitemap-posts-N.xml` (1,000 posts each), `/sitemap-news.xml` (last 48 h, Google News) | cached 15 min in the browser, 1 h at the edge |
| `/robots.txt` | blocks `/admin`, `/api/` and `/search` and lists the sitemaps. Editable under Settings > SEO (empty = this automatic file; "Allow search engines" off always wins) |
| `/rss.xml` + `<link rel="alternate">` | full text or summary only (Settings > Reading), categories, author |
| `X-Robots-Tag: noindex` | all `/admin` and `/api/` responses |
| Search results and error pages | `noindex` |

"Allow search engines" off gives `noindex, nofollow` on every page, `Disallow: /` in robots.txt, empty sitemaps and an empty feed.
After deploying, submit `https://your-site/sitemap.xml` (and the news sitemap) in Google Search Console.

## Languages

**Public site**: its own texts (buttons, labels, messages, page titles), the `<html lang>` attribute, the Open Graph locale and the month and day names follow
**Settings > General > Language**. Indonesian and English are included. To add a language, copy `web/src/lib/i18n/id.ts` to `<code>.ts` and translate it
(the type checker fails until every key is there), register it in `web/src/lib/i18n/translator.ts` and in `LANGUAGES` in `web/src/lib/shared/format-date.ts`.

**Admin panel**: every person picks their own language under *Profile > Appearance > Language* (or follows the site language). In the source the admin is
written in English: texts go through `tr('...')` and the English text itself is the key; the Indonesian translations are in `web/src/lib/i18n/admin/*.ts`.
A test (`tests/client/admin-i18n.test.ts`) fails when a text has no translation, a translation is unused, or a `{placeholder}` does not match. To add a language,
add a catalog for it in `web/src/lib/i18n/admin/catalogs.ts`.

Not translated: content you write (posts, categories, menus, widget titles) and the error messages the API returns.

## Roles

| Role | Can do |
|------|--------|
| `author` | create posts, edit and delete **own** posts, upload images, delete own uploads |
| `editor` | everything an author can, plus manage **all** posts, feature posts on the front page, categories, tags, **pages**, moderate comments, delete any media |
| `admin` | everything, plus users, settings, ads, themes, menus, widgets, WordPress import |

There is no public registration; admins create accounts under *Admin > Users*. The role is always read from the database, so demoting or deleting a
user takes effect immediately, even for tokens that have not expired.

## Ads

Managed under **Ads** in the admin (administrators only: ad code can contain scripts). An ad is a *banner* (image and link) or *ad code* pasted from an
ad network, placed at the top of the page, in the sidebar (top or bottom), before, inside (after the 2nd paragraph) or after an article, between news-list
items (every 5th story) or above the footer. Each ad can be limited to desktop or phones, given a start and end time, paused, and ordered within its place.

- Banner clicks go through `/ads/:id/click`, which counts them (30 per minute per visitor) and redirects to the stored link. The destination never comes from the request.
- Ad-code scripts are re-created in the browser so they run; they appear only to visitors, never in the admin.
- **Settings > Ads** has a master switch (off means no ads anywhere) and the text served at `/ads.txt`.
- Impressions are not tracked: use the ad network's own reports.

## Scheduled posts

Set a post to *Scheduled* and pick when it goes live (read in the timezone from Settings). Cloudflare Pages has no cron triggers, so due posts are
published by the first request after their time: a post goes live within about 30 seconds of its time as soon as anyone visits the site or the admin
(see `services/content/scheduler.service.ts`). Until then it is invisible everywhere: pages, search, sitemaps and RSS. Moving to Workers with a Cron
Trigger would only need a call to `publishDuePosts()` from the `scheduled` handler.

## Security notes

- **Sessions**: HS256 JWT (7 days) in an `httpOnly; SameSite=Lax` cookie or `Authorization: Bearer`. `JWT_SECRET` is mandatory in production.
- **CSRF**: state-changing requests must be same-origin (`Origin` / `Referer` / `Sec-Fetch-Site`); cookie-authenticated requests with no provenance are rejected.
- **Brute force**: logins are throttled per email (5 failures in 15 min) and per IP; public comments to 5 per minute per IP. The counters live in each
  Worker isolate (best effort): add a Cloudflare Rate Limiting rule on `/api/auth/login` for a hard guarantee.
- **HTML**: post content, excerpts, widgets and imported content are sanitised with an allow-list (`sanitize-html`); comments are plain text, rendered escaped.
- **Uploads**: images only (JPEG, PNG, GIF, WebP, AVIF), type decided from the magic bytes, random server-side names, served with `nosniff` and a sandboxing CSP.
  Theme archives are validated (path traversal, file types, size, template syntax) before anything is written.
- **Two-factor sign-in** (Profile > Security): an authenticator app (TOTP, RFC 6238, replay-protected) and/or a 6-digit email code (10 minutes, 5 attempts,
  single use), plus 10 one-time recovery codes. After the password step the browser only gets a short-lived *challenge* token that cannot be used as a
  session. Wrong codes are throttled per account and per IP. Turning a factor off, or making new recovery codes, asks for the password.
- **Session revocation**: changing or resetting a password, or turning 2FA off, bumps the account's `session_version` and signs out every other device.
- **Secrets at rest**: the SMTP password and TOTP seeds are encrypted (AES-256-GCM) with a key derived from `JWT_SECRET`. If you rotate `JWT_SECRET` they
  become unreadable: enter the SMTP password again, and affected users set up their authenticator again (recovery codes still work).
- **Settings**: secrets (`jwt_secret`, `smtp_*`) are never returned by any API or page and cannot be written through the settings API.
- **Not covered**: a Content-Security-Policy for the admin UI (CKEditor needs inline styles), and sandboxing of uploaded Handlebars themes (only admins
  can install themes; treat a theme like code).

To report a vulnerability, please open a private security advisory on GitHub instead of a public issue.

## Testing

```bash
npm test                      # unit and API integration tests (vitest, in-memory SQLite with the real migrations)

# end-to-end against the real Cloudflare runtime (workerd with local D1/R2)
cd web && npx vite build
rm -rf .wrangler/e2e && for f in drizzle/*.sql; do npx wrangler d1 execute wordsvelte-db --local --persist-to .wrangler/e2e --file=$f; done
npx wrangler pages dev .svelte-kit/cloudflare --persist-to .wrangler/e2e --port 8799 --binding JWT_SECRET=local-e2e-secret-123456
node scripts/e2e-smoke.mjs http://127.0.0.1:8799     # needs a fresh database
```

The end-to-end script has not been re-run for the newest features (dashboard, 2FA, scheduling, ads); run it before deploying a release.

## Contributing and versioning

See [CONTRIBUTING.md](CONTRIBUTING.md). The project follows [Semantic Versioning](https://semver.org/) and keeps a [changelog](CHANGELOG.md).
Indonesian quick start: [README.id.md](README.id.md).

## License

[MIT](LICENSE)
