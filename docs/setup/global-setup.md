# Global Setup Guide

This guide documents the standard local setup for the full Fromcode stack using local domains (`*.framework.local`), Docker services, and workspace scripts.

## 1. Requirements

- Node.js `22+`
- npm `11+`
- Docker + Docker Compose
- Local DNS/hosts entries for:
  - `api.framework.local`
  - `admin.framework.local`
  - `frontend.framework.local`
  - `marketplace.framework.local` (optional)

## 2. Repository Layout

- Framework runtime: `framework/Source`
- Shared plugins: `plugins`
- Shared themes: `themes`
- Prebuilt/theme source examples: `prebuilt`, `themes/snapbilt-theme`

## 3. Environment Configuration

From `framework/Source`:

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

If you use shared plugin/theme folders outside `framework/Source`, set:

- `SHARED_PLUGINS_DIR`
- `SHARED_THEMES_DIR`

## 4. Start the Stack

From `framework/Source`:

```bash
npm install
npm run dev
```

This starts all workspace dev servers and uses Docker Compose services (`db`, `redis`, etc.) according to `docker-compose.yml`.

## 5. Service URLs

- API: `http://api.framework.local`
- Admin: `http://admin.framework.local`
- Frontend: `http://frontend.framework.local`

## 6. Build Commands

From `framework/Source`:

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
- Plugin docs: each plugin's own `README.md` (e.g. `plugins/cms/README.md`)
- Theme docs: each theme's own `README.md` (e.g. `themes/blog/README.md`)
