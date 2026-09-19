# Global Setup Guide

> **Maintainer environment — not a recommended install path.** This describes the multi-hostname
> `*.framework.local` setup used when developing the framework itself. It needs hosts entries and an
> external reverse proxy, and it is deliberately not linked from the documentation index. If you are
> installing or evaluating Atlantis, use the [Quick Start](../../README.md#-quick-start) or the
> [installation guide](../installation.md) instead.

This guide documents the local setup for the full Atlantis stack using local domains (`*.framework.local`), Docker services, and workspace scripts.

## 1. Requirements

- Node.js `22+`
- npm `10+` (the version bundled with Node 22)
- Docker + Docker Compose
- Local DNS/hosts entries for:
  - `api.framework.local`
  - `admin.framework.local`
  - `frontend.framework.local`
  - `marketplace.framework.local` (optional)

## 2. Repository Layout

Paths below are relative to the repository root — the directory this clone sits in. Every command in
this guide runs from there.

- Framework runtime: `packages/` (core, api, admin, frontend, cli, …)
- Local dev starter and proxy: `starters/local/`
- Plugin mount point: `plugins/` — **empty in a fresh clone.** It is gitignored and populated by
  installing plugins, or by checking out plugin repositories into it. Plugins are separate products
  and are not part of this repository.
- Theme mount point: `themes/` — same arrangement as `plugins/`.

`PLUGINS_DIR` and `THEMES_DIR` name these roots for every service; see section 3.

## 3. Environment Configuration

From the repository root:

```bash
cp .env.example .env
```

Important variables to review:

- `API_URL=http://api.framework.local`
- `NEXT_PUBLIC_API_URL=http://api.framework.local`
- `ADMIN_URL=http://admin.framework.local`
- `FRONTEND_URL=http://frontend.framework.local`
- `API_VERSION_PREFIX=v1`
- `CORS_ALLOWED_DOMAINS=framework.local,api.framework.local,admin.framework.local`
- `PLUGINS_DIR=/app/plugins`
- `THEMES_DIR=/app/themes`
- `MARKETPLACE_URL=http://marketplace.framework.local`

Each extension root has exactly ONE name — the container path above (`PLUGINS_DIR`, `THEMES_DIR`,
`APPEARANCE_DIR`). Every service that reads them mounts those same paths, so the api cannot be
installing into one directory while the frontend renders from another. There is deliberately no
second, host-side variable to override them with.

## 4. Start the Stack

From the repository root:

```bash
docker compose up -d db
npm install
npm run dev
```

`npm run dev` runs each workspace's own dev server (`npm run dev --workspaces --if-present`). It does
**not** start the Docker services — bring `db` up first, or the api exits on its first connection
attempt.

There is no bundled Redis. `REDIS_URL` is empty by default and the cache runs in-process; point it at
a Redis you run yourself only if you want a shared one.

## 5. Service URLs

- API: `http://api.framework.local`
- Admin: `http://admin.framework.local`
- Frontend: `http://frontend.framework.local`

## 6. Build Commands

From the repository root:

```bash
npm run build
npm run build:api
npm run build:admin
npm run build:frontend
```

## 7. Plugin/Theme Development

- Plugins are resolved from `PLUGINS_DIR`.
- Themes are resolved from `THEMES_DIR`.
- Keep plugin/theme code out of framework packages when feature scope is plugin/theme-specific.
- Rebuild plugin UIs after changes when required by your plugin bundling flow.

## 8. Seeding and Reset Workflow

When testing content-heavy modules (CMS, forms, ecommerce, mlm, etc.):

1. Reset data/migrations with your current project reset command.
2. Re-run plugin/theme seeds.
3. Verify the target collection schemas match the seed fields.
4. Confirm front-end routes resolve through CMS (`/system/resolve`) without fallback mismatches.

## 9. Troubleshooting

### `fetch failed` from frontend server components

- Verify `NEXT_PUBLIC_API_URL` and `API_URL`/`INTERNAL_API_URL` are correct for your deployment mode.
- Ensure API container is healthy.
- Check DNS resolution for `api.framework.local` from both host and container.

### CMS pages return `Unknown block type`

- Confirm plugin UI bundle loaded.
- Ensure block component registry keys match stored block `type` values.

### Plugin routes/collections return `403` or `Collection not found`

- Check plugin is installed and active.
- Confirm required permissions are declared in plugin `manifest.json`.
- Validate dependency plugins (for example ecommerce/logistics/mlm depend on finance).

### Sandbox metrics show zero

- Ensure plugins are active and `sandbox: true` in manifest (or default sandbox policy applies in runtime).
- Verify the sandbox runtime process is healthy.

## 10. Documentation Map

- Module index: `docs/modules/README.md`
- Per-package docs: `docs/modules/packages`
- Plugin docs: each installed plugin ships its own `README.md` under `plugins/<slug>/`
- Theme docs: each installed theme ships its own `README.md` under `themes/<slug>/`
