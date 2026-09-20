# Isolated verify stack (`fcverify`)

A second, throwaway copy of the platform for LOOKING at a change — a separate Docker Compose
**project** that runs the framework's **existing images** (`framework-api:latest`,
`framework-frontend:latest`) against their own empty SQLite file, their own redis and their own
network. It never touches the shared local stack: not the `framework-*` containers, not
`framework/Source/.env`, not `data/app.db`, not the shared redis, not Traefik. That is the point:
the shared stack holds the client's data and may be in use by someone else at the same time.

```
./scripts/verify-stack/verify-stack.sh up            # start api + frontend + redis
./scripts/verify-stack/verify-stack.sh seed fromcode # admin, cms/forms/seo, activate + seed the theme, SEO siteUrl
./scripts/verify-stack/verify-stack.sh status
./scripts/verify-stack/verify-stack.sh restart api|frontend   # after ./build-plugins.sh pack theme <slug>
./scripts/verify-stack/verify-stack.sh logs api
./scripts/verify-stack/verify-stack.sh down          # ONLY the fcverify containers/network/volumes + its state dir data
```

| what | where |
|---|---|
| api | `http://127.0.0.1:3999` (`VERIFY_API_PORT`) — bound to loopback only, no Traefik labels |
| frontend | `http://127.0.0.1:3998` (`VERIFY_FRONTEND_PORT`) |
| admin | not run (nothing here needs the admin UI; the seed uses the in-container CLI + the admin API) |
| database | its OWN `postgres:15-alpine` in the `fcverify` project, volume `fcverify_pgdata` — three roles (bootstrap superuser, `fcverify_owner` for migrations, `fcverify_app` for requests), `DB_DIALECT=postgres` |
| redis | the project's own `redis:7-alpine` (not `framework-redis-1`) |
| uploads / private storage | `$VERIFY_STATE_DIR/uploads`, `$VERIFY_STATE_DIR/storage-private` |
| plugins / themes / appearance | the SAME host checkout the framework project mounts (`Source/plugins`, `Source/themes`, `Source/appearance`), so a freshly packed theme or plugin is what gets verified. Mounted **read-only** for both containers (`VERIFY_EXT_MOUNT_MODE=rw` if a step ever needs the api to write there — none of `up`/`seed` does). |
| state dir | `VERIFY_STATE_DIR` (default `$TMPDIR/fcverify`); holds `env/`, `data/`, the generated env files and the throwaway admin password |

## How the environment is derived

`up` runs `docker compose config --format json` **in the framework project** — a read-only render of
its resolved configuration (`docker-compose.yml` + `deploy/docker-compose.full-stack.yml` + `.env` +
`plugins.env`) — and `lib/derive-env.ts` writes `env/api.env` and `env/frontend.env` from the
`api`/`frontend` service environments with exactly these changes:

- every `http://api.framework.local` → the api origin, `http://frontend.framework.local` → the frontend
  origin, `http://admin.framework.local` → `http://127.0.0.1:3997` (no admin runs; links only);
- api: `DATABASE_URL=file:/app/data/verify.db`, `DB_DIALECT=sqlite`, `REDIS_URL=redis://redis:6379`,
  `CORS_ALLOWED_DOMAINS=127.0.0.1,localhost`, `COOKIE_DOMAIN=` (host-only cookies on a loopback
  origin), `STORAGE_PUBLIC_URL=<api>/uploads`, `NEXT_PUBLIC_API_URL=<api>`, `INTERNAL_ADMIN_URL=`;
- frontend: `API_URL=http://api:3000` (server-side fetches, the project's own service name),
  `NEXT_PUBLIC_API_URL=<api>`, `FRONTEND_URL=<frontend>`.

Secrets (`JWT_SECRET`, `INTEGRATION_SECRET_KEY`, `INTERNAL_SERVICE_SECRET`, plugin keys) are carried
over as the framework project resolves them; the generated files live in the state dir, never in the
repo. `DB_DIALECT`/`DATABASE_URL` are overridden whatever the framework project currently uses, so a
shared stack on Postgres still gives an isolated SQLite here.
`DATABASE_MIGRATION_URL` is rewritten to the same SQLite file too: the framework config carries a
Postgres owner-role URL and the database package prefers it for migrations, so without the rewrite
the api boots against a `db` host this stack does not have.

**Tenancy (api images built on or after 2026-09-03):** the api resolves a tenant from the request Host
and REFUSES unknown hosts (`404 unknown_host`). A fresh `verify.db` has an empty `_system_tenants`; insert
one row before the first request, e.g. primary host `127.0.0.1` with aliases `localhost`, `api`,
`frontend`, `admin` (the container-to-container hostnames), then restart the api.

### The built-in `NEXT_PUBLIC_API_URL`

The frontend image bakes `NEXT_PUBLIC_API_URL=http://api.framework.local` into its client bundle at
build time. That value is the LAST fallback, not the first: the server render resolves the public
api origin from the runtime environment (`ServerApiUtils.buildPublicApiBaseUrl` → `NEXT_PUBLIC_API_URL`
/ `API_URL` read through `process.env[key]`, which Next does not inline) and publishes it to the
browser as `window.FROMCODE_API_URL`, which every client resolver checks before the baked constant.
So with `NEXT_PUBLIC_API_URL=http://127.0.0.1:3999` in `frontend.env` the served HTML, the inlined
theme CSS (font urls), the theme/plugin bundle URLs and the browser's API calls all use the isolated
api — verified by reading the served HTML and the browser's request list (no `framework.local`
request). No `/etc/hosts` entry is needed and none is made. If a future frontend build reads the
baked constant FIRST somewhere, the symptom is a request to `api.framework.local` in the browser's
network list; that is a framework bug to fix, not something this stack works around.

## `seed <theme>`

1. `fromcode auth create-admin verify@fromcode.local <random>` in the api container (password in
   `$VERIFY_STATE_DIR/admin-password`, generated once, never printed).
2. `fromcode plugin enable cms|forms|seo`, then the api is restarted **twice** (the forms plugin
   creates its default form on the second boot that sees it enabled).
3. `POST /api/v1/themes/<slug>/activate` as that admin (`lib/verify-admin.ts`, run inside the
   container against `localhost:3000`; login carries `X-Requested-With` so CSRF is skipped for the
   programmatic call).
4. The theme's BUILT seed `dist/packages/build/themes/<slug>/seed.ts` (from `./build-plugins.sh pack
   theme <slug>`) is copied into the data mount and run **inside the api container** from `/app`
   (`lib/verify-seed-runner.ts`: `DatabaseFactory.create(DATABASE_URL)` → `connect()` →
   `<Seed>.seed(db)`), so `@fromcode119/*` resolve from `/app/node_modules`. The runner refuses any
   `DATABASE_URL` outside `/app/data/`.
5. Api restart (it caches plugin settings at boot — the seed wrote the SEO row from outside), then
   `PUT /api/v1/plugins/seo/settings` with `siteUrl=<frontend origin>` and a read-back check.
6. Frontend restarted twice (the api also asks it to restart after a settings change — the compose
   `restart: unless-stopped` policy brings it back), then the home `<title>` is printed.

Re-seeding an existing verify DB is not supported: `down` then `up` + `seed` for a fresh one.

## Proving isolation

Before and after a session, compare `docker inspect --format '{{.Id}} {{.State.StartedAt}}'
framework-api-1 framework-frontend-1 …` and `md5 framework/Source/.env`: unchanged means untouched.
`docker ps` shows the `fcverify-*` containers beside the `framework-*` ones; `docker network ls`
shows `fcverify_fcverify` beside `framework_framework`.

## Lighthouse / Playwright

Point the batch at the isolated frontend: `ORIGIN=http://127.0.0.1:3998
_archive/lighthouse-2026-09-03/2026-09-03/run.sh <label>` (the script reads `ORIGIN` from the
environment). Best-practices on this stack scores 81, not 78 as on `*.framework.local`: `redirects-http`
(weight 1) passes on a loopback origin, while `is-on-https` (weight 5) still fails — Lighthouse counts
only `https:` and the literal `localhost` host as secure, and `127.0.0.1` is neither. Compare that
category only against another run on the same kind of origin.

## Known limitation (2026-09-03): the client bundle's API URL is baked at image build time

`framework-frontend:latest` is built with `NEXT_PUBLIC_API_URL=http://api.framework.local` (Dockerfile ARG),
so the isolated frontend's server render is isolated but its BROWSER runtime calls the shared api — plugin
lists, plugin bundles and every client fetch go to whatever the shared api currently is. Lighthouse numbers
from such a run are NOT comparable (no plugin JS loads). Build a dedicated image for this stack:

```bash
cd framework/Source && docker build --build-arg NEXT_PUBLIC_API_URL=http://127.0.0.1:3999 -t framework-frontend:verify .
```

and point `scripts/verify-stack/docker-compose.yml`'s frontend service at `framework-frontend:verify`.

## Admin on this stack (2026-09-03)

The admin service (`127.0.0.1:3997`) serves its pages, static assets and the `/fc-runtime/icons/**` files
(the login page's icons are a real check of the icon loader). Its BROWSER API calls do not work here:
`ApplicationUrlUtils.inferBrowserBaseUrl` treats a loopback origin as "the api is on my own origin", so
the client calls `127.0.0.1:3997/api/v1/...`, which the admin does not proxy (the middleware matcher
excludes `api`) — the console shows `Unexpected token '<'` for the init/i18n/health calls. Logged-in admin
smoke therefore needs the shared stack (or a hostname-based admin origin). Not a framework bug on the
shared stack, where `admin.framework.local` → `api.framework.local` by host role.

## Islands rollout on this stack (2026-09-03)

`VERIFY_ISLANDS=1 ./verify-stack.sh up` starts the frontend with `STOREFRONT_DOCUMENT_ISLANDS=1` (content
paths served as static documents + `/fc-runtime/runtime-<hash>.js`), plus a second frontend
`frontend-approuter` on `127.0.0.1:3996` with the flag forced off. Compare them with
`node docs/website-mockup/lighthouse/head-parity.ts http://127.0.0.1:3996 http://127.0.0.1:3998`.
