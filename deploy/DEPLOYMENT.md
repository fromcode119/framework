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

**Prefer `atlantis deploy` over running those by hand.** From a checkout of this repository:

```bash
atlantis deploy v2.0.0                 # target defaults to "staging"
atlantis deploy v2.0.0 --target prod
```

It does the two commands above and the three things doing them by hand does not: it pulls BEFORE
touching `.env`, so an unpublished version changes nothing; it waits for the api to report **that
version** — asked inside the container, since a crash-looping image leaves the previous one
answering 200 — and rolls back automatically when it does not; and on success it removes our
published images except the live one and the rollback target. Nine releases in one day took a
staging disk from 16G to 25G before it existed.

The host can be given directly — `atlantis deploy v2.0.0 --host deploy@example.com --dir /srv/fromcode/deploy`
— or named once in `deploy/targets.json`. **That file is deliberately not committed**, and neither is
any host: an ssh address and a path on somebody's server are local configuration, and a framework
other people deploy has no business shipping one operator's infrastructure. Copy
`targets.example.json` to start one.

The server needs nothing but the compose files: the command drives it over ssh, and the host still
has no Node and no checkout.

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
that already runs a reverse proxy — whichever one — routes straight to `api`, `admin` and `frontend`
and never starts it: two proxies competing for port 80 is the failure this avoids.

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

`deploy/.env` — see `.env.example`. **Nothing in it has to be filled in for a first install.** The
secrets are generated on first boot, the database is chosen in the browser, and the domains are set
in the first-run wizard; what is left is what Docker Compose needs before any container exists, and
it already has working values.

Setting any of these still WINS over what the platform would do for itself, which is how every
existing deployment keeps behaving exactly as it did:

| Variable | Default | Why you might still set it |
|---|---|---|
| `COMPOSE_PROFILES` | `single-domain` in the example | Without it no port is published at all. Leave it off only when something else already fronts api/admin/frontend. |
| `GATEWAY_PORT` | `80` in the example | A free port, when a reverse proxy already holds 80. |
| `GATEWAY_TLS_PUBLISH` | `127.0.0.1:8443` | Where the gateway's HTTPS listener is published. Only does anything once `GATEWAY_TLS_PORT` is set (see `docs/certificates-and-tls.md`); set it to `0.0.0.0:443` when the gateway IS the edge, and leave it alone when a reverse proxy holds 443 — publishing there would put the gateway in front of that proxy's TLS and access policy. |
| `EXTERNAL_PROXY_NETWORK` | `atlantis-edge` | The network the app services join. As shipped, compose creates it. |
| `PROXY_NETWORK_EXTERNAL` | `true`, and `false` in the shipped `.env.example` | Whose network it is. `true` joins one somebody else created — a proxy you already run — and compose refuses to start if it is missing. `false` has compose create it, which is why a bare install runs no `docker network create`. Unset defaults to `true` so every deployment written before this behaves exactly as it did. |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / generated / `fromcode` | The superuser, spent once at boot to create the other two roles. The password is generated into a file the application cannot read. |
| `DATABASE_MIGRATION_URL` | written by the wizard | Schema owner — runs migrations. |
| `DATABASE_URL` | written by the wizard | Non-owner runtime login — what actually serves requests. Set BOTH or neither: one role for both jobs disables row-level security silently. |
| `JWT_SECRET` | generated into `data/secrets.json` | 32+ characters. Changing a live one signs every session out. |
| `INTEGRATION_SECRET_KEY` | generated into `data/secrets.json` | 32+ characters. Changing a live one makes every stored credential undecryptable. |

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
