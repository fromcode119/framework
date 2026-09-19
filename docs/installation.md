# Installation Guide

Welcome to **Atlantis**. This guide walks through every supported way to install and run it, from a
one-command local Docker stack to a production server with zero checkout.

> For the shortest path, see the Quick Start section in the [repo README](../README.md). This
> page covers every option in full, plus production deployment.
>
> For the package-by-package map, see the [module documentation index](./modules/README.md).

## Prerequisites

- **Node.js**: v22 or higher (required for `isolated-vm` plugin sandboxing)
- **npm**: v10 or higher (or pnpm)
- **Git**
- **Docker + Docker Compose** *(optional)*: for containerized deployment, and for PostgreSQL in local dev

## Option 1: Install on your server — the normal way to run it in production

No checkout, no Node, no build. Two compose files and a database password.

### 1. Fetch the compose files

```bash
mkdir fromcode && cd fromcode
base=https://raw.githubusercontent.com/fromcode119/framework/main/deploy
curl -fsSLO $base/docker-compose.full-stack.yml
curl -fsSLO $base/docker-compose.images.yml
curl -fsSL  $base/.env.example -o .env
```

### 2. There is no step 2

The `.env` you just downloaded needs no editing. Nothing in it is a credential: the three secrets are
generated on first boot, the database is chosen in the browser, and the domains are set in the
wizard. What it holds is the handful of things Docker Compose needs *before* any container exists —
which is exactly why those cannot be asked for on a web page — and they already have working values.

The one worth knowing about is `COMPOSE_PROFILES=single-domain`, which runs the bundled gateway and
publishes a port. Without it nothing is reachable: the default shape assumes a reverse proxy already
routes to the containers, so the stack starts healthy and answers nowhere. If something else already
holds port 80 on this host, change `GATEWAY_PORT`. Behind a proxy you already run, point
`EXTERNAL_PROXY_NETWORK` at ITS network and set `PROXY_NETWORK_EXTERNAL=true`, so compose joins that
network instead of creating its own — whatever that proxy is.

### 3. Start it

```bash
docker compose -f docker-compose.full-stack.yml -f docker-compose.images.yml pull
docker compose -f docker-compose.full-stack.yml -f docker-compose.images.yml up -d
```

### 4. Open it

Go to the server — its IP is fine, no DNS needed yet. The wizard asks for the database first and
shows exactly what it will create: the server, the database, the two roles, and the file the
generated passwords go into. Confirming restarts the platform so it can connect, which takes about
twenty seconds and the page waits for it.

Then it asks the four things that are yours to decide: your language, an administrator account, a
name for the platform, and the domain the admin should answer on, prefilled with whatever you
arrived on. Setup is accepted for 15 minutes after start, and only from whoever gets there first.

Three database roles are created, not one: PostgreSQL skips row-level security for superusers and
table owners, so the role that serves requests must be neither.

You can also point the wizard at a database you already run, which is the route for a managed
PostgreSQL or for MySQL — the bundled stack ships PostgreSQL, so anything else needs a server you
name. There it asks for two roles rather than one wherever the driver keeps sites apart, because
serving requests as the role that owns the tables switches that separation off with no error, and
the roles have to exist already: nothing in the platform holds a credential privileged enough to
create them on someone else's server.

| Driver | Sites | Notes |
|---|---|---|
| **PostgreSQL** | many | Row-level security keeps each site's data separate. The bundled default. |
| **SQLite** | one | One file, no server. No row-level security, so it has nowhere to put a second site's rows. |
| **MySQL** | one | Real roles and backups, but no row-level security either — same limit as SQLite, for now. |

Updating is the same two commands with `VERSION=` set to a newer tag. `deploy/DEPLOYMENT.md` covers
proxies, TLS, the split-service and single-domain shapes, and running without Docker.

## Option 2: Local development — fastest for contributing

### 1. Clone the repository

```bash
git clone https://github.com/fromcode119/framework.git
cd framework
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env as needed — the database credentials are the only ones required
```

The default `.env` expects a PostgreSQL at `localhost:5432` (start one with `docker compose up -d db`, or point
`DATABASE_URL` at your own). A zero-setup single-site alternative on SQLite lives in `starters/local/` — it has no
multi-site mode, because SQLite cannot enforce row-level security.

You do not have to decide here. An installation with no database configured serves a first-run wizard at
`/admin/setup` that asks for the driver and connection itself and writes the file for you — see
[Quick Start](../README.md#-quick-start) for the shortest path. Editing `.env` up front is the explicit
alternative, not a prerequisite.

### 3. Install and migrate

```bash
npm install
npm run atlantis -- db migrate
```

### 4. Start the development environment

```bash
# Full stack: Proxy + API + Admin + Frontend (all on port 3000)
npm run dev:local

# API + Admin only
npm run dev:local:api-admin

# API only
npm run dev:local:api
```

**Dev URLs:**

| Surface | URL |
|---------|-----|
| **API** | `http://localhost:3000/api/v1` |
| **Admin Panel** | `http://localhost:3000/admin` |
| **Frontend** | `http://localhost:3000` |

On a database with no users yet, the admin opens a first-run wizard: language, your administrator
account, the platform name, and the domain the admin will answer on. It accepts setup for 15 minutes
after start, and only from whoever gets there first.

> `dev:local` starts a lightweight proxy on port 3000 that routes `/api` to the API (port 4000), `/admin` to the Admin panel (port 3001), and everything else to the Frontend (port 3002).

## Option 3: Docker Compose — reproducible local environments

### 1. Configure environment

```bash
cd framework
cp .env.example .env
# Edit .env — the database credentials are the only ones required
```

### 2. Start all services

```bash
# Full stack (API + Admin + Frontend + PostgreSQL)
docker compose up -d

# API + Admin only
docker compose up -d api admin db
```

There is no bundled Redis service. `REDIS_URL` is empty by default and the cache runs in-process; set
it only to point at a Redis you run yourself.

**Services:**

| Service | Port | Description |
|---------|------|-------------|
| `api` | 3000 | REST API |
| `admin` | 3001 | Admin panel (Next.js) |
| `frontend` | 3002 | Public frontend (Next.js) |
| `db` | 5432 | PostgreSQL 15 |

### 3. Check logs and stop

```bash
docker compose logs -f api

# Stop (keep data)
docker compose down

# Stop and remove database volume
docker compose down -v
```

## Option 4: Coolify — recommended for self-hosted production

[Coolify](https://coolify.io) is the recommended way to run Atlantis in production on your own infrastructure with zero-downtime deployments and automatic TLS.

### 1. Install Coolify on your server

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

### 2. Create a new service

1. In Coolify, create a new **Docker Compose** resource from public repository `https://github.com/fromcode119/framework`
2. Point it to `deploy/docker-compose.full-stack.yml`
3. Set the required environment variables, at minimum `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`
4. Set `EXTERNAL_PROXY_NETWORK` to the actual Coolify proxy network name on the host. Do not rely on `docker_web` unless your host really uses that network name.
5. Point the proxy's routes at the `gateway` service; set `COMPOSE_PROFILES=single-domain` only for the path-routed single-site shape (see the routing shapes below)
6. Add a GitHub webhook: repo → Settings → Webhooks → Payload URL from Coolify → `application/json` → push event

### 3. Choose the routing shape

| Mode | What the proxy forwards | What runs |
|------|------|-----------|
| Multi-site (host-routed) | every hostname → `gateway` | Gateway routes by host from the site table → API / Admin / Frontend |
| Single domain (path-routed) | one hostname → `gateway` (`COMPOSE_PROFILES=single-domain`) | Gateway routes `/api`, `/admin`, else frontend |
| Split services | one hostname per service, no gateway | API + Admin + Frontend exposed directly |

The gateway needs `INTERNAL_SERVICE_SECRET` to fetch the routing map. Set it for all services, or let the api generate it and give the gateway the same `data/` volume to read it from. Without it the gateway falls back to path routing, as the single-domain gateway always did.

### 4. Deploy

Click **Deploy** in Coolify. Atlantis will install plugin dependencies, run migrations, and start. Coolify handles zero-downtime rolling updates and automatic TLS provisioning.

### 5. Notes for proxy networking

- The full-stack compose file joins an external proxy network using `EXTERNAL_PROXY_NETWORK`.
- The default fallback is `docker_web` for existing local/server setups, but Coolify commonly uses a different network name.
- If the proxy network name is wrong, containers will start but Coolify routing will not attach correctly.

## Option 5: Docker manual build — custom production images

Build a specific deployment mode image from the repo root:

```bash
cd framework

# Full-stack image
docker build --target full-stack -t fromcode:full .

# API + Admin image
docker build --target api-admin -t fromcode:api-admin .

# API-only image (lightest)
docker build --target api-only -t fromcode:api .

# Run
docker run -d \
  --env-file .env \
  -p 3000:3000 \
  -p 3001:3001 \
  fromcode:api-admin
```

**Build targets:**

| Target | Includes |
|--------|----------|
| `api-only` | API server only — lightest image |
| `api-admin` | API + Admin panel |
| `full-stack` | API + Admin + Frontend |
| `frontend-only` | Frontend renderer only |

## First Run / Onboarding

On your first visit, you will be prompted to create an administrative account. This process initializes the database and sets up the core system settings.

## Production Deployment

For production, the pre-configured Docker templates in the `deploy/` directory (used by Options 1, 4
and 5 above) cover:

- **Full-Stack**: Standard production deployment.
- **API-Only**: Headless deployment.
- **Frontend-Only**: Edge deployment connecting to an external API.

See `deploy` for the compose templates, and `deploy/DEPLOYMENT.md` for proxy/TLS
notes.
