# Fromcode — App Starter

Zero Docker. Zero Postgres. Zero Redis. SQLite + local disk only.

All services run behind a single reverse proxy — one browser tab, one URL:
**`http://localhost:3000`**

---

## Quick start (inside the framework monorepo)

This starter lives at `starters/local/` inside the Fromcode repository.
Until `@fromcode119/*` packages are published to npm, the scripts run the
framework packages directly using `npm run --prefix`.

```bash
# 1. From the framework root, install all workspace dependencies
cd framework/Source
npm install

# 2. Configure your local environment
cp .env.example .env               # or create framework/Source/.env
#    Minimum: set JWT_SECRET. SQLite + in-memory cache work with no other changes.

# 3. Start (from this starters/local/ directory)
cd starters/local
npm install        # installs concurrently + http-proxy locally
npm run dev:api-admin
```

Open `http://localhost:3000/admin/setup` → create your admin account → done.

---

## After @fromcode119/* packages are published

```bash
# Scaffold a new project (coming soon)
npx @fromcode119/create my-app
cd my-app
npm install
npm run dev:api-admin
```

The `package.json` `dependencies` block already shows the intended package
names (`@fromcode119/api`, `@fromcode119/admin`, …) — only the script internals change
(the `--prefix ../../packages/…` paths become installed binary calls).

---

## Commands

| Command | URL | Services |
|---|---|---|
| `npm run dev:api-admin` | `:3000` | proxy → api `:4000` + admin `:3001` |
| `npm run dev` | `:3000` | proxy → api `:4000` + admin `:3001` + frontend `:3002` |
| `npm run dev:api` | `:4000` | API only |
| `npm run start:api-admin` | `:3000` | production build + proxy |
| `npm run start:api` | `:4000` | production API only |

Path routing through the proxy:
- `/api/*` → API (`:4000`)
- `/admin*` → Admin panel (`:3001`)
- `/*` → Frontend (`:3002`) or Admin if no frontend

---

## Environment

Use `framework/Source/.env`.

```env
DB_DIALECT=sqlite
DATABASE_URL=file:../../data/app.db
JWT_SECRET=change-me-min-32-chars
REDIS_URL=                          # blank = in-memory cache
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_BASE_PATH=/admin
```

See `.env.example` for the full reference.

---

## Adding a plugin

1. Drop a folder into `plugins/` with `manifest.json` + `index.ts`  
2. Restart the API — it auto-discovers plugins on startup  

See `plugins/hello-world/` for a minimal example.  
Test: `GET http://localhost:3000/api/v1/hello-world/hello`

## Adding a theme

Drop a folder into `themes/` with `theme.json` (no build step for CSS themes).  
See `themes/my-theme/theme.json` for an example.

---

## SQLite data

Stored at `framework/Source/data/app.db` (gitignored).  
Delete the file to reset all data and re-run setup.
