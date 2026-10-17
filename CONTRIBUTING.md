# Contributing

Thanks for helping. This is a small project, so the process is light.

## Set up

```bash
git clone https://github.com/mroyyan/wordsvelte.git
cd wordsvelte
npm install
npm run dev          # http://localhost:5173, local SQLite, migrations applied automatically
npm test             # all unit and API tests (about half a minute)
cd web && npx svelte-check --threshold error     # type check
```

## Before opening a pull request

- Tests pass and `svelte-check` reports no errors. New behaviour comes with a test in `web/tests/server` (or `client`).
- Keep the layering: **routes -> services -> repositories -> db**. SQL only in `web/src/lib/server/repositories`. `architecture.test.ts` fails if you cross it.
- A change to the database schema needs a migration: edit `shared/src/schema/index.ts`, run `cd web && npx drizzle-kit generate --name <what>`, commit the
  generated SQL and snapshot, and mention the migration in the changelog. Migrations only add; never edit one that has been released.
- Anything that handles secrets, sessions or user input gets extra care: see *Security notes* in the README.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, with an optional scope
(`feat(admin): ...`). Say what changed and why in a sentence or two.

## Versioning and releases

The project follows [Semantic Versioning](https://semver.org/). While the major version is `0`, a **minor** bump may contain breaking changes
and a **patch** bump is only fixes.

To release (maintainers):

1. Move the `[Unreleased]` entries in `CHANGELOG.md` under a new `## [x.y.z] - date` heading, list any new migration files, and update the compare links at the bottom.
2. Set the same version in `package.json`, `web/package.json` and `shared/package.json`.
3. Commit as `chore(release): vX.Y.Z`, then tag it: `git tag -a vX.Y.Z -m "vX.Y.Z"` and push the tag.
4. The `wordsvelte` installer package (`packages/wordsvelte`) is versioned and published to npm on its own; bump it only when the installer changes.
