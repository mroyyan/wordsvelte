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
npx create-wordsvelte my-news
cd my-news
npm run dev -w web
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

Jika sudah login via `npx create-wordsvelte` atau `wrangler login`:

```bash
npm run deploy -w web
```

Atau setup manual:

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
│   │   │   ├── server/
│   │   │   │   ├── auth/       # JWT auth
│   │   │   │   ├── db/         # Database (D1 + SQLite)
│   │   │   │   ├── crypto/     # Password hashing
│   │   │   │   ├── themes/     # Handlebars theme engine
│   │   │   │   ├── services/   # Business logic layer
│   │   │   │   ├── validators/ # Input validation
│   │   │   │   └── errors/     # Error classes
│   │   │   └── components/
│   │   │       ├── ui/         # shadcn-svelte components
│   │   │       ├── admin/      # Admin components
│   │   │       └── widgets/    # Sidebar widgets
│   │   └── routes/
│   │       ├── api/           # REST API
│   │       └── admin/         # Admin panel
│   ├── themes/                # Theme templates
│   ├── drizzle/               # DB migrations
│   └── wrangler.toml          # Cloudflare config
└── package.json               # Root workspace
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Production | JWT signing secret (set via `wrangler secret put`) |
| `DB` | Auto | D1 database binding |
| `R2` | Auto | R2 bucket binding |

In development, JWT secret is auto-generated and persisted in the database. No `.env` file needed.

## License

MIT
