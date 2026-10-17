# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/) (while the major version is 0, a minor release may contain breaking changes).

**Database migrations** are listed under each release. When upgrading, run the migration files that are new since your last deploy (see the README).

## [Unreleased]

## [0.1.0] - 2026-10-17

First versioned release. Fresh installs apply migrations `0000` to `0005` (all files in `web/drizzle/`).

### Added
- Ads: banners and ad-network code in eight placements, with run dates, device targeting, click counting and `ads.txt` (migration `0005_ads.sql`).
- RSS content setting (full text or summary only) and a `robots.txt` editor under Settings.
- Scheduled publishing for posts, with a calendar and time picker in the site timezone.
- Two-factor sign-in (authenticator app or email code, plus recovery codes), profile page, password change, SMTP settings with an encrypted password and a test email (migration `0004_two_factor.sql`).
- Static pages with menu integration (migration `0003_pages.sql`) and WordPress page import.
- Password reset by email (migration `0002_password_resets.sql`).
- SEO package: canonical URLs, Open Graph / Twitter cards, JSON-LD, sitemaps including Google News, `robots.txt`, RSS.
- Dashboard with real figures, settings wired to the public site, live search dialog, mobile menu as a sheet.
- Admin redesigned after shadcn-admin: shared data table with bulk actions, two-column sign-in pages, settings and profile sections.

### Changed
- Settings fields are spaced closer together.
- Public site redesigned (black header, hero with a featured slider, flat sections on phones); the recent and popular widgets now show site-wide posts.
- Server code reorganised by layer (core, http, auth, repositories, services, mail, seo) and checked by an architecture test; all SQL lives in repositories.

### Security
- Versioned database migrations (`0000_schema`, `0001_seed_defaults`); sessions carry a version that is bumped on password change, reset or turning 2FA off.
- CSRF protection, rate limiting, HTML sanitising, upload validation, secrets never returned by the settings API.
- `JWT_SECRET` is required in production.

## Earlier history

Development before 0.1.0 (June 2026) was not versioned: first commit, themes, widgets and menus, setup page, the `npx wordsvelte` installer.

[Unreleased]: https://github.com/mroyyan/wordsvelte/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mroyyan/wordsvelte/releases/tag/v0.1.0
