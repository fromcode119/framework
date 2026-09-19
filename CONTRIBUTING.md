# Contributing to Atlantis

Thanks for looking at contributing. This document covers the local setup, the checks a change must
pass, and how a change gets merged.

## Development setup

```bash
git clone https://github.com/fromcode119/framework.git
cd framework
cp .env.example .env
docker compose up -d
```

See [docs/installation.md](docs/installation.md) for the full set of local/production install paths,
and [docs/setup/global-setup.md](docs/setup/global-setup.md) for the `*.framework.local` domain
workflow used day to day.

## Before opening a pull request

Run the gates that apply to what you changed. All of these are real `npm run` scripts defined in
this package's `package.json`; run them from the repository root.

| You changed | Run |
|---|---|
| Anything | `npm run build` — the full build pipeline (typecheck, all architecture guards, admin + frontend builds) |
| Plugin/theme code that talks to `context.db` | `npm run check:db-find-where` |
| Plugin/theme imports | `npm run check:sdk-boundary` and `npm run audit:core-boundary` |
| Plugin admin UI components | `npm run check:plugin-ui-hookfree` and `npm run check:plugin-ui-types` |
| Any plugin | `npm run check:plugin-architecture` (or `:strict` for ecommerce/finance/cms) |
| Framework packages (`packages/**`) | `npm run check:framework-oop:error` |
| Admin or frontend (`packages/admin`, `packages/frontend`) | `npm run check:app-typecheck` and `npm run build:admin` / `npm run build:frontend` — **`next build` does not type-check**, `check:app-typecheck` is the real type gate |
| Plugin/theme logic | `node_modules/.bin/vitest run --config vitest.plugins.config.ts` (also `npm run test:framework`) |

`npm run build` is the authoritative gate — it chains the typecheck, every architecture guard, and
both Next.js app builds in the order CI expects. A PR that doesn't pass it won't be merged.

## Branch naming

- `feature/short-description` — new features
- `fix/bug-description` — bug fixes
- `refactor/component-name` — code improvements with no behavior change
- `docs/what-changed` — documentation only

## Commit messages

```
type(scope): short description

- Bullet points for details (optional)
```

- **Types**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- **Scope**: the plugin, theme, or package the change touches

## Opening a pull request

`main` is protected — every change ships through a pull request, including small fixes and version
bumps. Direct pushes to `main` are not accepted.

1. Push your branch and open a PR against `main`.
2. Make sure the gates in the table above pass for what you touched.
3. Describe *why* the change is needed, not just what it does.

## Reporting a vulnerability

Security issues have their own process — see [SECURITY.md](SECURITY.md). Please don't open a public
issue for a vulnerability.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
