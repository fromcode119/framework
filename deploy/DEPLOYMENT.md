# Deploying the framework

Three ways, in order of preference. The first is what you want unless you have a specific reason.

---

## 1. Pull prebuilt images (recommended)

The server runs containers and nothing else — no source checkout, no Node, no build toolchain, no
compiler running next to your production database.

```bash
cd deploy
cp .env.example .env        # then fill it in — see "Configuration" below
export VERSION=v2.0.0       # a published tag; omit to track :latest

docker compose -f docker-compose.full-stack.yml -f docker-compose.images.yml pull
docker compose -f docker-compose.full-stack.yml -f docker-compose.images.yml up -d
```

Updating is the same two commands with a new `VERSION`. Rolling back is the same two commands with
the previous one — no rebuild, so it takes seconds either way.

Images are **public**, so the server needs no `docker login` and no registry credentials —
verified by pulling on a host with no ghcr entry in its Docker config.

Note for anyone republishing under a different org: GHCR packages are created **private by default,
even when the source repository is public**, and an org policy can forbid making them public at all
(`Settings → Packages → Package creation`). Both had to be changed here before an anonymous pull
worked. A green build is not proof the images are reachable — check with an unauthenticated pull.


| Image | Contents |
|---|---|
| `ghcr.io/fromcode119/framework-api` | the API |
| `ghcr.io/fromcode119/framework-admin` | the admin UI |
| `ghcr.io/fromcode119/framework-frontend` | the storefront |
| `ghcr.io/fromcode119/framework-gateway` | single-domain ingress — only under the `single-domain` profile |

They are built and published by `.github/workflows/publish-images.yml`, which runs when a `v*` tag
is pushed. `auto-tag.yml` creates those tags automatically when `package.json`'s version changes on
`main`, so a release is a version bump. The repository is public, so **CI and image hosting cost
nothing**; if it is ever made private, both begin billing.

### Behind your own proxy
The `gateway` service sits behind a `single-domain` profile and is **not** started by default. A host
that already runs Traefik, nginx or Caddy routes straight to `api`, `admin` and `frontend` and never
starts it — two proxies competing for port 80 is the failure this avoids.

---

## 2. Build from source

For working on the framework itself, or running a commit that has no tag yet.

```bash
git clone https://github.com/fromcode119/framework.git
cd framework/deploy
docker compose -f docker-compose.full-stack.yml up -d --build
```

Everything from option 1 applies, except the machine now needs enough CPU and RAM to build four
Next.js images. Budget several GB of RAM: Next builds are memory-hungry, and a 2-core box with 8 GB
is close to the floor. This is a fine way to develop and a poor way to run production.

---

## 3. Without Docker — supported, strongly discouraged

It works, and it is your problem when it breaks. You take on, by hand, everything the images
otherwise guarantee:

- **Node 22** (matching `NODE_BASE_IMAGE`), **PostgreSQL 15+**, **Redis 7+** installed and supervised
  by you.
- **Three database roles**, created by hand: a superuser used once for bootstrap, a schema owner for
  migrations, and a non-owner runtime login. The app must never connect as the superuser — a
  superuser silently bypasses row-level security, so tenant isolation becomes decorative while
  everything still looks healthy.
- **Process supervision** for each app (systemd or similar), restart policies, log rotation.
- **Reproducing the Dockerfile's build steps** for each target, and keeping them in step with it
  after every upgrade. When they drift, you get a bug nobody else can reproduce.

```bash
npm ci
npm run build
# then run each app under your own supervisor, with the same environment variables the
# compose file sets for api / admin / frontend
```

There is no support path for this. Use it only where containers genuinely cannot run; if the reason
is "Docker feels heavy", option 1 is lighter than this in every way that matters.

---

## Configuration

`deploy/.env` — see `.env.example`. These values have **no defaults** and the stack refuses to start
without them:

| Variable | Why |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | the superuser, spent once at boot to create the other two roles |
| `DATABASE_MIGRATION_URL` | schema owner — runs migrations |
| `DATABASE_URL` | non-owner runtime login — what actually serves requests |
| `JWT_SECRET` | 32+ characters, unique per deployment |
| `INTEGRATION_SECRET_KEY` | 32+ characters, unique per deployment |
| `PROXY_NETWORK` | the EXISTING external network your reverse proxy is on (e.g. `edge`). On Coolify, `${COOLIFY_RESOURCE_UUID}` |

Generate secrets with `openssl rand -base64 48 | tr -d '=+/' | cut -c1-48`. Keep `.env` at mode
`600`; never commit it.

`MARKETPLACE_URL` may be left **empty**, which disables marketplace lookups. Plugin and theme
updates come from their own repositories.

## Optional: the PDF renderer

Plugins that print PDFs (today: the numerology booklet export) do it in a **separate browser
service**, not inside the api. Chromium plus its system libraries was ~977MB baked into every
API-bearing image, for a feature most installs never use.

It lives in **one** file, `docker-compose.pdf.yml`, added as an overlay — adding the file is the
opt-in, so there is no profile to remember and no copy of the service in each mode's compose file:

```bash
PDF_RENDERER_TOKEN=... docker compose -f docker-compose.full-stack.yml -f docker-compose.pdf.yml --project-directory . up -d
```

Then set the address in admin — **Numerology → Settings → PDF renderer URL**:

```
ws://pdf-renderer:3000/chromium/playwright?token=<PDF_RENDERER_TOKEN>
```

Nothing is discovered automatically: with that setting empty, booklet exports fall back to the
plugin's built-in PDFKit layout instead. The service is deliberately not published and not on the
proxy network — it renders arbitrary HTML, so only this stack may reach it.
