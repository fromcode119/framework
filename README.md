<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="packages/frontend/public/brand/atlantis-logo-white.png">
  <img alt="Atlantis by Fromcode" src="packages/frontend/public/brand/atlantis-logo-slate.png" width="340">
</picture>

**The open-source application framework by Fromcode**

[![GitHub Stars](https://img.shields.io/github/stars/fromcode119/framework?style=for-the-badge&logo=github&color=gold)](https://github.com/fromcode119/framework)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative)](https://opensource.org/licenses/MIT)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22+-green?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript 5+](https://img.shields.io/badge/TypeScript-5+-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-cyan?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-orange?style=for-the-badge)](https://orm.drizzle.team/)

---

*Deploy specialized business domains as isolated, composable plugins — a hardened application kernel that orchestrates plugins, themes, and packages through a unified TypeScript monorepo with zero lock-in on any layer.*

</div>


> **Why Atlantis?** Traditional frameworks hand you raw materials but no system. CMS platforms lock you into their schema. SaaS products lock you into their pricing. Atlantis is none of those — it's a production-hardened application kernel that handles identity, security, migrations, queues, media, AI hooks, and real-time out of the box, while remaining completely modular and provider-agnostic at every layer. Build a SaaS product, a content platform, a marketplace, a logistics system, or all of the above — without re-architecting between them.

## Getting Started Fast

```bash
git clone https://github.com/fromcode119/framework.git
cd framework
cp .env.example .env
npm install
npm run dev:local
```

### Deploy with Coolify

1. In Coolify, create a new **Docker Compose** resource from public repository `https://github.com/fromcode119/framework`
2. Set **Docker Compose Location** to `deploy/docker-compose.full-stack.yml`
3. Set required environment variables: `API_URL`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `POSTGRES_USER`, `POSTGRES_DB`
4. Set `EXTERNAL_PROXY_NETWORK` to the actual Coolify proxy network name on your server. Do not rely on `docker_web` unless your host really uses that network name.
5. The **platform gateway** is the one upstream your proxy forwards every hostname to (it routes by host from the site table). On a single-site install you may instead set `COMPOSE_PROFILES=single-domain` for the path-routed shape (`example.com/api`, `example.com/admin`), or leave it unset to expose api, admin and frontend as separate services.
6. Add a GitHub webhook: repo → Settings → Webhooks → Payload URL from Coolify → `application/json` → push event
7. Deploy

---

### Key Capabilities

🔐 **Built-in RBAC + MFA** — Users, Roles, Permissions, TOTP 2FA, and recovery codes baked directly into the kernel. No plugin required.

🧩 **Plugin Ecosystem** — Domain plugins (CMS, eCommerce, Finance, Logistics, LMS, MLM, Forms, SEO, Analytics, Privacy, and more) register themselves into kernel lifecycle phases. Install from the marketplace or build your own.

⚡ **Unified Infrastructure** — One kernel manages Cache (Redis/Memcached/In-Memory), Queue (BullMQ/Local), Email (SMTP/SendGrid/Mailgun), and Storage (S3/Cloudinary/Local) for all plugins.

🤖 **AI Out of the Box** — First-class LLM hooks for OpenAI, Anthropic, Ollama and compatible APIs, plus vector operations and content pipeline hooks, are built into the kernel — no extra setup, no third-party wiring.

🔧 **Built-in MCP Server** — Every installation is an [MCP](https://modelcontextprotocol.io) server: Claude (and any MCP client) can list content, swap page images by named slot, read orders and invoices, update products, and purge caches — over stdio or hosted Streamable HTTP, gated by scoped access tokens minted in the admin. Plugins ship their own tool packs through `context.mcp.registerTools()`.

🏢 **Multi-site, one platform** — Serve many customer sites from one deployment. Every site has its own hosts, content, people, plugins and theme; isolation is enforced twice, by the application and by PostgreSQL row-level security, so a query that forgets its filter still returns only that site's rows. A site is either a **storefront** (a theme on its domain) or a **workspace** (its domain *is* the console, locked to a product appearance). The platform admin runs all of them from one Sites page; a site's own admins see only their site.

🌐 **Framework-owned edge** — The platform gateway routes every hostname from the site table: storefront hosts → frontend, workspace hosts → admin, `api.` aliases → api, unknown hosts → 404. Creating a site on the Sites page is live within a second — no proxy rules, no generated files. Your reverse proxy only terminates TLS — or the gateway can do that too (below).

🔒 **TLS certificates in the admin** — A certificate is a record in the platform, not a file on a server. Upload one per host (chain + key, validated before anything is stored, key encrypted at rest); the Certificates page lists every address the platform answers for, soonest to expire first, including the ones with no certificate at all. The platform sends its own expiry warnings at 30/14/7/1 days because [Let's Encrypt stopped sending them in June 2025](https://letsencrypt.org/2025/06/26/expiration-notification-service-has-ended), and it never silently replaces a certificate an operator paid for. Set `GATEWAY_TLS_PORT` and the gateway terminates TLS itself, answering each handshake from that store with no default certificate — so an unknown name is refused, never handed somebody else's. Leave it unset and nothing changes. Either way the framework states facts about hosts over three internal endpoints and never renders anybody's proxy config: no vendor is named anywhere in `packages/**`. See [Certificates and TLS](./docs/certificates-and-tls.md).

🎛️ **Admin appearances** — The admin is skinnable end to end: an installed appearance (`appearance/<slug>`) can replace the whole console for a product, declare which surfaces its users may reach, and declare the workspace preset (plugins) it provisions. The default console stays the platform admin's "configure" mode.

🏗️ **Zero Architecture Lock-In** — Run as API only, API + Admin, or Full Stack. Swap any provider (DB, cache, storage, email, queue) without touching business logic.

📊 **Atomic Migrations** — 7-phase database synchronization system handles schema updates across core and all active plugins atomically.

🛡️ **Kernel Security Loop** — Real-time threat detection, cryptographic plugin signature verification, and comprehensive audit logging built into the kernel.

🧱 **Plugin process isolation** — An isolated plugin runs in its own OS process under its own unprivileged user, with a heap ceiling, a per-call deadline and a read-only plugin directory; it talks to the kernel over a message contract and its requests carry the host's tenant, never its own claim. A crash or hang takes down that plugin only, and it is restarted in place. Isolation is a visible, declared setting per plugin (Settings → Infrastructure → Plugin Isolation), never a hidden default.

📦 **Backups + Site Transfer** — Managed system backups, constrained restore preview and execution, and a repository-root site-transfer bundle command are available from the framework-owned operations surface.

🏪 **Plugin Marketplace** — Install plugins from the built-in marketplace. Every team can host their own private marketplace. Plugins and core are upgradable in place without breaking changes.

🌍 **Built-in i18n** — Multi-language support is a first-class kernel feature. Localize content (per-field `localized: true` locale maps), admin UI labels, and plugin data without external libraries.

🕘 **Version History Everywhere** — Every admin edit of any plugin's record is snapshotted to a framework-owned versions table, with one-click restore in the admin and matching MCP tools. Not a CMS feature — a kernel feature.

🔀 **Framework-owned Redirects** — Redirect rules and canonical paths live in the kernel (Settings → Redirects) with server-side 308s. Renaming a URL keeps every old link alive without an SEO plugin.

🏛️ **Pure OOP Codebase** — Every layer is class-based. No standalone exported functions anywhere. Routers extend `BaseRouter`, middlewares extend `BaseMiddleware`, utilities live in service classes — and the UI layer runs on the standalone `reactor`/`next-build-codegen`/`typescript-multiple-inheritance` stack. Consistent, predictable, and fully tree-shakable.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 22+** (required)
- **npm 10+** or **pnpm**
- **Git**
- **Docker + Docker Compose** (for containerized deployment)

---

<details open>
<summary><b>Option 1: Local Development</b> — Fastest for contributing</summary>

#### 1. Clone the repository

```bash
git clone https://github.com/fromcode119/framework.git
cd framework
```

#### 2. Configure environment

```bash
# Copy the example env file
cp .env.example .env

# Edit .env as needed — at minimum, set a strong JWT_SECRET before running
```

The default `.env` expects a PostgreSQL at `localhost:5432` (start one with `docker compose up -d db`, or point
`DATABASE_URL` at your own). A zero-setup single-site alternative on SQLite lives in `starters/local/` — it has no
multi-site mode, because SQLite cannot enforce row-level security.

#### 3. Install and migrate

```bash
npm install
npm run fromcode -- db migrate
```

#### 4. Start the development environment

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

> `dev:local` starts a lightweight proxy on port 3000 that routes `/api` to the API (port 4000), `/admin` to the Admin panel (port 3001), and everything else to the Frontend (port 3002).

</details>

---

<details>
<summary><b>Option 2: Docker Compose</b> — Recommended for reproducible local environments</summary>

#### 1. Configure environment

```bash
cd framework
cp .env.example .env
# Edit .env — set DB credentials, JWT_SECRET, NEXT_PUBLIC_API_URL, etc.
```

#### 2. Start all services

```bash
# Full stack (API + Admin + Frontend + PostgreSQL + Redis)
docker compose up -d

# API + Admin only
docker compose up -d api admin db redis
```

**Services:**

| Service | Port | Description |
|---------|------|-------------|
| `api` | 3000 | REST API |
| `admin` | 3001 | Admin panel (Next.js) |
| `frontend` | 3002 | Public frontend (Next.js) |
| `db` | 5432 | PostgreSQL 15 |
| `redis` | 6379 | Cache / Queue backend |

#### 3. Check logs and stop

```bash
docker compose logs -f api

# Stop (keep data)
docker compose down

# Stop and remove database volume
docker compose down -v
```

</details>

---

<details>
<summary><b>Option 3: Coolify</b> — Recommended for self-hosted production</summary>

[Coolify](https://coolify.io) is the recommended way to run Fromcode in production on your own infrastructure with zero-downtime deployments and automatic TLS.

#### 1. Install Coolify on your server

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

#### 2. Create a new service

1. Go to your Coolify dashboard → **New Resource** → **Docker Compose**
2. Point it to `deploy/docker-compose.full-stack.yml`
3. Set all required **Environment Variables** in the Coolify dashboard
4. Set `EXTERNAL_PROXY_NETWORK` to the actual Coolify proxy network name on the host
5. Point the proxy's routes at the `gateway` service; set `COMPOSE_PROFILES=single-domain` only for the path-routed single-site shape

#### 3. Choose the routing shape

| Mode | What the proxy forwards | What runs |
|------|------|-----------|
| Multi-site (host-routed) | every hostname → `gateway` | Gateway routes by host from the site table → API / Admin / Frontend |
| Single domain (path-routed) | one hostname → `gateway` (`COMPOSE_PROFILES=single-domain`) | Gateway routes `/api`, `/admin`, else frontend |
| Split services | one hostname per service, no gateway | API + Admin + Frontend exposed directly |

The gateway needs `INTERNAL_SERVICE_SECRET` (shared with the api) to fetch the routing map; without it, it falls back to path routing and behaves as the single-domain gateway always did.

#### 4. Deploy

Click **Deploy** in Coolify. Fromcode will install plugin dependencies, run migrations, and start. Coolify handles zero-downtime rolling updates and automatic TLS provisioning.

#### 5. Notes for proxy networking

- The full-stack compose file joins an external proxy network using `EXTERNAL_PROXY_NETWORK`.
- The default fallback is `docker_web` for existing local/server setups, but Coolify commonly uses a different network name.
- If the proxy network name is wrong, containers will start but Coolify routing will not attach correctly.

</details>

---

<details>
<summary><b>Option 4: Docker Manual Build</b> — Custom production images</summary>

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

</details>

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` at the repo root.

<details open>
<summary><b>Core Settings</b></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `development` \| `production` |
| `JWT_SECRET` | — | **Required.** Minimum 32 characters. Set before going live. |
| `DB_DIALECT` | `postgres` | `postgres` (every multi-site deployment) or `sqlite` (single-site only) |
| `DATABASE_URL` | `postgresql://…` | Full DB connection string |
| `PORT` | `3000` | API server port |
| `ADMIN_PORT` | `3001` | Admin panel port |
| `FRONTEND_PORT` | `3002` | Frontend server port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Browser-facing API URL (Next.js public env) |
| `API_URL` | `http://localhost:3000` | Server-to-server API URL (use Docker service name in containers, e.g. `http://api:3000`) |
| `CORS_ALLOWED_DOMAINS` | `localhost` | Comma-separated allowed origins |
| `DEFAULT_LOCALE` | `en` | Default language/locale |

</details>

<details>
<summary><b>Database (PostgreSQL)</b></summary>

```bash
DB_DIALECT=postgres
DATABASE_URL=postgresql://USER:PASS@localhost:5432/fromcode
POSTGRES_USER=fromcode
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=fromcode
```

> **Why PostgreSQL everywhere:** sites are isolated by a PostgreSQL row-level-security policy. SQLite has no
> such feature, so a multi-site install must run PostgreSQL — locally too, otherwise the isolation you rely on
> in production is never exercised on your machine. SQLite still works for a single-site install.
>
> **Why three roles:** PostgreSQL skips row-level security for the table owner and for superusers. If the app
> connected as either, every site would see every other site's rows and nothing would look wrong. So the app
> connects as a plain role (`DATABASE_URL`), a separate owner role runs migrations, and the superuser is never
> used by the app.

</details>

<details>
<summary><b>Integrations — Cache, Queue, Storage, Email</b></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | _(empty)_ | Redis connection string. Leave blank for in-memory cache. |
| `STORAGE_DRIVER` | `local` | `local`, `s3`, or `cloudinary` |
| `STORAGE_UPLOAD_DIR` | `./public/uploads` | Local upload path |
| `EMAIL_PROVIDER` | `mock` | `mock`, `smtp`, `sendgrid`, or `mailgun` |
| `SMTP_HOST` | — | SMTP server host |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password |

</details>

<details>
<summary><b>Multi-site, Gateway & Isolation</b></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `INTERNAL_SERVICE_SECRET` | — | Shared secret for service-to-service calls: the gateway's routing map, operator restart endpoints. Required for host routing. |
| `GATEWAY_INTERNAL_URL` | `http://gateway:3000` | Where the api pushes routing reloads when a site is created, changed or removed |
| `GATEWAY_ROUTING_TTL_MS` | `30000` | How long the gateway keeps its routing map before refreshing (it also keeps the last map if the api is down) |
| `API_TARGET_URL` / `ADMIN_TARGET_URL` / `FRONTEND_TARGET_URL` | `http://api:3000` … | The gateway's upstreams |
| `GATEWAY_PORT` | `80` | Host port the gateway listens on (compose) |
| `GATEWAY_TLS_PORT` | _(unset)_ | Opt in to the gateway terminating TLS from the certificate store. Unset = unchanged behaviour; something in front holds the certificates |
| `GATEWAY_CERTIFICATES_TTL_MS` | `60000` | How long the gateway keeps its certificate bundle before refreshing (last good bundle survives an api outage) |
| `APPEARANCE_DIR` | `./appearance` | Installed admin appearances (product consoles) |
| `ADMIN_APPEARANCE` | _(empty)_ | Deployment default appearance for a standalone product install (a single-site deployment that IS a workspace) |

> Multi-site mode switches on by itself when the site table has rows; an installation with no sites behaves exactly as a single-site install. Adding the first site needs a restart.

</details>

<details>
<summary><b>Rate Limiting, Security & Plugins</b></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `PLUGINS_DIR` | `./plugins` | Path to plugins directory |
| `THEMES_DIR` | `./themes` | Path to themes directory |
| `MARKETPLACE_URL` | `https://marketplace.fromcode.com` | Plugin marketplace site URL |

</details>

---

## 📦 Core Features

<details open>
<summary>🔐 <b>Security & Identity</b> — RBAC, MFA, Sandboxing, Audit Logs</summary>

| Feature | Description |
|---------|-------------|
| **Users, Roles, Permissions** | Full RBAC system. Define granular permissions and assign them to roles, roles to users. |
| **Built-in MFA (TOTP)** | Native Time-based OTP with recovery code generation and encrypted secret storage. Works with any authenticator app. |
| **Security Monitor** | Real-time threat detection loop that monitors for anomaly spikes, brute-force attempts, and suspicious patterns. |
| **Plugin Process Isolation** | An isolated plugin is a separate OS process (own unprivileged user, heap ceiling, per-call deadline, read-only code dir) speaking a message contract; capabilities are declared in the manifest and a drift is HELD until a platform admin re-approves it. |
| **Cryptographic Signing** | Plugin signature verification on load. Unsigned or tampered plugins are rejected. |
| **TLS Certificates** | One record per host in `_system_certificates`. The chain is stored in the clear (every visitor is handed it); the private key is encrypted at rest with `SecretService` and leaves the store through exactly one method, reached only by a secret-gated internal endpoint that must never be published through the edge. Uploads are platform-admin only and validated — key/certificate pair, host coverage, expiry — before anything is written. |
| **Audit Logging** | Comprehensive audit trail via `AuditManager` (`_system_audit_logs`) covering admin collection mutations, MCP tool calls, plugin database writes, capability violations, and rate-limit denials. |
| **Record Version History** | Every create/update through the admin/REST surface snapshots the record to `_system_record_versions` — for every collection of every plugin, not just CMS. Version History UI with one-click restore; also exposed over MCP (`content.versions_list` / `version_get` / `version_restore`). |
| **JWT + API Keys** | Out-of-the-box support for JWT access tokens, refresh token rotation, and long-lived API keys. |
| **SSO** | Single Sign-On provider integrations via the auth extension system. |

</details>

---

<details>
<summary>⚙️ <b>Infrastructure & Integrations</b> — Queue, Cache, Storage, Email, WebSockets</summary>

The kernel manages all shared infrastructure so plugins share resources without collision.

| Service | Providers | How It Works |
|---------|-----------|--------------|
| **Cache** | Redis, Memcached, In-Memory | Single `CacheManager` instance shared across all plugins. Configure driver once in `.env`. |
| **Queue** | BullMQ (Redis), Local polling | `QueueManager` handles background job processing. Redis for distributed, local for dev. |
| **Storage** | Local, S3, Cloudinary | `StorageManager` abstracts file I/O. Swap providers without changing plugin code. |
| **Email** | SMTP, SendGrid, Mailgun, Mock | `EmailManager` unified interface. Mock provider for local dev, real providers for production. |
| **WebSockets** | Native WS | `WebSocketManager` enables real-time events between server and themes/admin. |
| **Webhooks** | Outbound HTTP | `WebhookService` dispatches events to external systems on any kernel hook. |

</details>

---

<details open>
<summary>🤖 <b>AI-Native Architecture</b> — LLM Hooks, Vector Operations, Content Pipelines — Out of the Box</summary>

| Capability | Description |
|------------|-------------|
| **LLM Provider Hooks** | Built-in integration points for OpenAI, Anthropic, Ollama and compatible APIs. |
| **Vector Operations** | First-class support for embedding generation and similarity search. Plug in any vector DB. |
| **Content Pipeline Hooks** | Kernel-level hooks for pre/post content processing — run summarization, tagging, or moderation automatically. |
| **AI in Plugins** | Any plugin can register AI-powered actions via the `context.ai` API without managing credentials. |

</details>

---

<details>
<summary>🗄️ <b>Database Layer</b> — Not Locked to Any ORM or Driver</summary>

| Capability | Description |
|------------|-------------|
| **Driver Abstraction** | Database connections managed by the kernel. Plugins receive a typed `context.db` — never manage connections directly. |
| **PostgreSQL (default)** | The database for every environment, local included. Per-site isolation is a row-level-security policy the database enforces; the app connects as a plain role, never as the owner or a superuser. |
| **SQLite** | Single-site installs only (`DB_DIALECT=sqlite`): zero setup, no row-level security, so no multi-site mode. |
| **Drizzle ORM** | Default query builder. Full TypeScript inference for schema and queries. |
| **7-Phase Migrations** | Atomic migration orchestration across core and all active plugins simultaneously. Schema changes are coordinated, not scattered. |

</details>

---

<details open>
<summary>🏢 <b>Multi-site Tenancy</b> — Sites, Workspaces, Isolation, Provisioning</summary>

| Capability | Description |
|------------|-------------|
| **Sites** | A site is a customer: its own hosts (primary + aliases), content, people, plugin set, theme and settings on one shared platform. Resolved from the request host (storefront, api) or the signed session (admin), fail-closed: an unknown host is a 404, never a default site. |
| **Two layers of isolation** | Every tenant table carries `tenant_id`; the application injects the predicate on every query AND PostgreSQL row-level security refuses rows outside the bound site. Unique constraints are per site. |
| **Site kinds** | `site` = a storefront (theme on its domain, admins on the shared admin host). `workspace` = no storefront: the domain serves the admin, locked to a product **appearance**; the api sits on the same origin and on an `api.` alias for devices and apps. A workspace's own admins can never switch to the default console; the platform admin opens it either "as the product" or in configure mode, per session. |
| **Memberships & platform admin** | Users are members of sites with per-site roles; an admin of one site never sees another. The platform admin (`users.is_platform_admin`) runs every site from one admin with a site switcher, and is the only one who may install or platform-enable plugins, change platform keys or mint all-sites tokens. |
| **Per-site plugins, themes, settings** | Each site enables its own subset of the installed plugins (shared processes, never shared data), activates its own theme, and keeps its own plugin and system settings. New sites get their theme's initial pages seeded and their plugins' default pages materialized. |
| **Provisioning** | Sites page: create (kind, hosts, plugins, theme, or appearance + a preset the appearance declares), members, export to a portable archive, import with a preview, adopt an existing single-site deployment. A single-site install is migrated with the read-only `tenant-export` CLI. |
| **Platform gateway** | `fromcode system gateway`: routes every host from the site table, refreshed on a TTL and pushed on every change; `/healthz` reports the map age. Storefront hosts → frontend, workspace hosts → admin, `api.` aliases → api. |

</details>

---

<details>
<summary>🎛️ <b>Admin Appearances</b> — Product Consoles on the Same Admin</summary>

| Capability | Description |
|------------|-------------|
| **Installed appearances** | `appearance/<slug>/appearance.json` + a runtime bundle. Built with `fromcode build appearance <slug>`, loaded at runtime, switchable per site in Settings → Appearance (or locked by a workspace's kind). |
| **Surface allowlist** | An appearance declares which plugins and admin paths its users may reach; everything else shows a containment screen — a product console, not a re-skinned admin. |
| **Workspace presets** | An appearance that is a product's console declares the plugins that product runs (`workspace` block). The "New site" form offers one preset per such appearance; the framework itself names no product. |

</details>

---

<details>
<summary>🌍 <b>Built-in i18n</b> — Multi-language Support at the Kernel Level</summary>

Localization is a first-class feature of the kernel, not a plugin add-on. Every layer of the stack is i18n-aware.

| Capability | Description |
|------------|-------------|
| **Kernel-level Locale Engine** | The `I18nManager` handles locale resolution, fallback chains, and translation loading for the entire platform. |
| **Content Localization** | Collections and fields can be marked translatable. Plugins access translations through the kernel context. |
| **Admin UI Labels** | Admin panel field labels, navigation, and messages are fully localizable via the translation system. |
| **Plugin i18n** | Plugins register their own translation namespaces — no global conflicts. |
| **Default Locale Config** | Set `DEFAULT_LOCALE=en` in `.env`. Additional locales load from plugin/theme translation files at boot. |
| **Runtime Locale Switching** | Locale is resolved per-request via headers, query params, or user preferences — no server restart needed. |
| **Localized Fields** | Any collection field can declare `localized: true` — values are stored as per-locale maps and collapsed to the active locale on every read (REST and plugin `context.db` alike), with fallback to a locale that has content. Legacy flat strings keep working untouched. |

</details>

---

<details>
<summary>🏛️ <b>Class-Based Architecture</b> — Pure OOP, No Standalone Functions</summary>

Every piece of Atlantis follows a strict class-based pattern. There are no bare exported functions anywhere in the codebase.

| Layer | Pattern | Example |
|-------|---------|--------|
| **Routers** | Extend `BaseRouter` | `class AuthRouter extends BaseRouter` |
| **Middlewares** | Extend `BaseMiddleware` | `class AuthMiddleware extends BaseMiddleware` |
| **Controllers** | Plain classes with prototype methods | `class UserController { async getUser(...) {} }` |
| **Services** | Plain classes, pure when possible | `class OrderService { async create(...) {} }` |
| **Repositories** | Plain classes, data access only | `class OrderRepository { async findMany(...) {} }` |
| **Utilities** | Static methods on service classes | `AdminServices.getInstance().formatter.formatSize(n)` |

> **No arrow function methods.** Class methods always use prototype syntax and are bound explicitly when passed as callbacks: `router.get('/x', this.controller.handle.bind(this.controller))`.

On the UI side the same philosophy is carried by three **standalone packages** (usable in any React project, zero Atlantis dependencies):

| Package | Role |
|---------|------|
| `@fromcode119/react-class-components` | Class components without hook ceremony — `Reactor`/`PureReactor` base classes, `@prop`/`@state`/`@bound`/`@watch` decorators, method-bearing `Enum`, `Provider` contexts |
| `@fromcode119/next-build-codegen` | Build-time only — compiles separate `.view` JSX templates onto component classes and stamps `'use client'` directives; zero runtime cost |
| `@fromcode119/typescript-multiple-inheritance` | TypeScript build tool adding real OOP (multiple inheritance for data classes) and package-alias rewriting; also the framework's actual typecheck gate |

Data shapes are **classes**, not interface aliases — a `Person` or `Order` carries its own behavior and hydrates from API JSON via `static from(row)`. `interface` remains only for genuine behavioral contracts. See `REACTOR-DESIGN.md` for the full design.

This means every class is independently instantiable, mockable, and replaceable — making testing and extension straightforward at every layer.

</details>

---

| Mode | Command | Ports | Use Case |
|------|---------|-------|----------|
| **Full Stack** | `npm run start:all` | 3000, 3001, 3002 | Complete application with frontend theme |
| **API + Admin** | `npm run start:api-admin` | 3000, 3001 | Backend + admin UI, headless frontend |
| **API Only** | `npm run dev:local:api` | 3000 | Pure REST/GraphQL backend, maximum flexibility |
| **Local Dev** | `npm run dev:local` | 3000 (proxy) | All surfaces through a single local proxy |

> **Headless support**: Consume any Atlantis endpoint from your own React, Next.js, Vue, or native clients. No coupling to the bundled frontend.

</details>

---

## 🔌 Plugin Ecosystem

Atlantis ships with a growing ecosystem of domain plugins. Each plugin registers into the kernel lifecycle and communicates only through the kernel context — never directly importing across plugin boundaries.

<details open>
<summary><b>Available Plugins</b></summary>

Domain plugins register into the kernel lifecycle and are installed from the marketplace — the public catalogue is being prepared for release. You can build your own today, or host a private marketplace for your team.

Example domains a plugin can own:

| Domain | Purpose |
|--------|---------|
| Content | Headless CMS with block editor, pages, navigation, and collections |
| Commerce | Product registry, variant management, carts, and checkout flows |
| Ledger | Unified transaction engine, pricing, and revenue ledger |
| Delivery | Shipping providers, fulfillment tracking — country couriers as separate packs |
| Capture | Form builder, submission management, and webhook dispatch |
| Insights | Event tracking, dashboards, and traffic analytics |
| Discoverability | Meta management, sitemaps, structured data (redirect rules are framework-owned: Settings → Redirects) |

</details>

<details>
<summary><b>Plugin Structure</b> — How plugins are organized</summary>

```
plugins/<name>/
├── index.ts              # Exports only — thin entry point
├── manifest.json         # Plugin metadata, capabilities, dependencies
├── settings.ts           # Plugin configuration schema
├── src/
│   ├── on-init.ts        # Lifecycle registration (routes, hooks, collections)
│   ├── controllers/      # Request handlers — validation, orchestration
│   ├── services/         # Business logic — pure when possible
│   ├── repositories/     # Data access — queries only
│   └── types/            # TypeScript types, interfaces
├── collections/          # Drizzle database schemas
├── migrations/           # Schema migration files
└── ui/                   # Frontend bundle (React components)
```

</details>

<details>
<summary><b>Plugin Communication</b> — Cross-plugin isolation rules</summary>

Plugins never import directly from other plugins. All cross-plugin communication goes through the kernel:

| Channel | When to Use | Example |
|---------|-------------|---------|
| **HTTP API** | Frontend/runtime calling a plugin's API | `Plugins.namespace('org.fromcode').finance.getOverview()` |
| **Hooks / Events** | Backend plugin notifying others | `context.hooks.on('order.created', handler)` |
| **Database** | Backend accessing shared collections | `context.db.query.orders.findMany(...)` |
| **Settings** | Reading global configuration | `context.settings.get()` |

> All plugin runtime access is **namespace-scoped**: `Plugins.namespace('org.fromcode').finance` — never `Plugins.finance` directly.

</details>

---

## 🤖 MCP Server — AI Agent Access

Every Atlantis installation doubles as a **Model Context Protocol server**. An AI agent with a scoped
token can do real operator work — read and update content, swap a page's images by *named slot*,
inspect orders, shipments and invoices, upload media, purge caches — without ssh, database access, or
a human relaying clicks.

### Security model

- **Token-only access.** Tool calls authenticate with an `x-api-key` access token minted in
  **Settings → Integrations → MCP**. The raw key is shown exactly once; only its SHA-256 hash is
  stored. Session cookies are rejected on tool routes, and tokens cannot mint other tokens.
- **Two independent gates.** A token's **scopes** (`content.*`, `ecommerce.*`, …) limit which tools
  it may *reach*; each tool's own **permission** (`content:read`, `system:view`, `system:manage`, …)
  is then checked against the calling user's roles. Scopes only ever narrow — they never grant.
- **PII is tiered.** List projections carry no customer emails, addresses, banking or tax
  identifiers; single-record reads behind `system:view` include only what a permitted operator needs.
  Invoice tools are **read-only permanently** (the legal series is never mutated over MCP), and
  `deploy.restart` carries its own dedicated permission so no routine token can restart a server.
- **Everything is audited.** Every call lands in `_system_audit_logs` (tool name, user, argument
  *keys* — never values) plus a log line for live tailing.
- **Remote transport is off by default.** The hosted endpoint answers `403` until an operator flips
  **Settings → Integrations → MCP → Remote access**, and it is rate-limited per address.

### Sites

On a multi-site platform every token names the site it acts on. A site admin can only mint tokens for
their own site; the platform admin may mint an **all-sites** token and pick the site per call with the
`x-fc-site` header. The stdio server exposes two local tools, `sites.list` and `sites.select`, and
`FROMCODE_SITE` preselects one at launch; selecting a site re-announces the tool list, because the site
decides which plugins' tools exist. A workspace's console can also reach the hosted endpoint on its own
domain (`https://<workspace-domain>/api/v1/mcp`).

### Tool surface

| Namespace | Tools | Notes |
|---|---|---|
| `system.*`, `media.*`, `cache.*`, `deploy.*` | server time, media list/upload/replace, framework cache purge, process restart | `media.replace` always writes a **new filename** so CDNs cannot serve stale bytes; `cache.purge` reports the CDN half honestly (`cdn: false` when no credentials exist) |
| `content.*`, `collections.*`, `settings.*`, `plugins.*`, `themes.*`, `web.*`, `backups.*` | the Admin Assistant's full toolset, exposed per request | built lazily from the live request, so they always match what the in-admin assistant can do |
| `content.versions_*` | `versions_list` / `version_get` / `version_restore` | record version history over MCP, for every plugin's collections — list snapshots, read one, or restore it (a restore applies the full snapshot and records itself as a new version) |
| `cms.*` | `cms.page.slots.list` / `cms.page.slots.set` | **named slots**: "the second gallery image" instead of raw block JSON; writes go through the same service the admin visual editor uses |
| `ecommerce.*` | products list/get/**update**, orders list/get/**updateStatus** | writes run the canonical admin paths — collection hooks fire, order-status transitions are guarded (terminal states are final) |
| `mlm.*`, `logistics.*`, `finance.*` | partners, commissions, shipments, invoices | read-only; PII-tiered projections |

The list a client sees is always **live** — the scope picker and `tools/list` are derived from
whatever is registered at that moment, so a newly installed plugin's tools appear with zero
configuration.

### Connecting Claude

**Claude Code, local stdio** (recommended for development). Drop a `.mcp.json` next to where you run
`claude` (never commit it — it holds a live token):

```json
{
  "mcpServers": {
    "fromcode": {
      "command": "node",
      "args": ["framework/Source/packages/mcp-server/dist/bin.js"],
      "env": {
        "FROMCODE_API_URL": "http://api.framework.local/api/v1",
        "FROMCODE_API_TOKEN": "<token from Settings → Integrations → MCP>"
      }
    }
  }
}
```

`FROMCODE_API_URL` is the FULL api base — origin plus the versioned prefix your deployment serves.

Restart Claude Code and run `/mcp` — the fromcode server lists its tools. From there, plain requests
("list the vision-board image slots", "show pending orders") route through the tools automatically.

**Claude Code, hosted endpoint** (production — no local binary). Enable **Remote access** in the
admin first, then:

```bash
claude mcp add --transport http fromcode https://api.<your-domain>/api/v1/mcp \
  --header "x-api-key: <token>"
```

**claude.ai web/desktop custom connectors** authenticate via OAuth and cannot send a custom
`x-api-key` header — connecting claude.ai directly needs an OAuth layer in front of the endpoint
(not shipped yet). Claude Code works with both transports today.

Mint **one token per purpose**, scoped tight: a content-editing token gets `content.* media.* cms.*`;
a reporting token gets `ecommerce.* finance.*`; nothing routine gets `deploy.*`. Revoking a token in
the admin cuts access instantly.

### Plugin tool packs

A plugin ships its own tools from `on-init.ts` — no framework changes, no registration files:

```ts
import { McpSchema } from '@fromcode119/sdk';

context.mcp.registerTools([
  {
    tool: 'myplugin.things.list',            // only `<own-slug>.*` — anything else throws at boot
    title: 'List things',
    description: 'List this plugin\'s things, newest first.',
    readOnly: true,
    permission: 'content:read',              // checked against the caller's roles on every call
    inputSchema: McpSchema.object({
      limit: McpSchema.number({ description: 'Things to return, 1-100.' }),
    }),
    handler: async (input, { user }) => ({ items: [] }),
  },
]);
```

The registry enforces the namespace boundary (a plugin can never shadow another plugin's or the
framework's tools), a re-initialised plugin *replaces* its previous registration instead of
colliding with it, and a tool without a schema or permission is hidden rather than callable.
Writes that must fire collection lifecycle hooks (licensing, ledger, search listeners) go through
`context.collections.update(slug, id, data, { user })` — the same controller path an admin save
takes — never through raw `context.db.update`.

---

## 🛠️ Build & CLI

<details>
<summary><b>Build Commands</b></summary>

```bash
# Build the complete framework
npm run build

# Build individual targets
npm run build:api        # API TypeScript compilation
npm run build:admin      # Admin panel (Next.js)
npm run build:frontend   # Frontend (Next.js)

# Build all plugins (from repo root)
./build-plugins.sh
```

</details>

<details>
<summary><b>Architecture Checks</b></summary>

```bash
# Check plugin layer violations (warn mode / strict)
npm run check:plugin-architecture
npm run check:plugin-architecture:strict

# SDK boundary audit — plugins/themes may import ONLY @fromcode119/sdk
npm run check:sdk-boundary
npm run audit:core-boundary

# db.find/db.count filters must live under where:{...}
npm run check:db-find-where

# Plugin admin UI must be hook-free OOP classes
npm run check:plugin-ui-hookfree

# Framework OOP conventions (class-based, no export const components)
npm run check:framework-oop

# Real type gate for the Next apps (next build does NOT typecheck)
npm run check:app-typecheck
```

</details>

<details>
<summary><b>The Atlantis CLI</b></summary>

```bash
npm run fromcode -- <command>
```

Commands are grouped: `fromcode <group> <command>`.

| Command | Description |
|---------|-------------|
| `plugin create [name]` | Scaffold a new plugin with the correct structure in `plugins/` |
| `plugin build / pack / publish <slug>` | Build, tarball, or publish a plugin |
| `plugin install <slug>` / `plugin search` | Install from / search the marketplace |
| `theme create [name]` | Scaffold a new theme in `themes/` |
| `theme seed` | Seed theme configuration data (also `npm run seed:theme`) |
| `db migrate / rollback / seed / status / reset` | Atomic schema synchronization across all active plugins |
| `test / lint / typecheck / doctor` | Quality gates and environment diagnosis (top-level commands) |
| `system info / version / site-transfer-bundle` | Operations — including the full site-transfer bundle |
| `system gateway` | The platform gateway (container entrypoint of the `gateway` image): host routing from the site table |
| `node dist/cli/tenant-export.js --database … --uploads … --slug … --host …` | Read-only export of a single-site deployment into a site archive the Sites page can import |
| `auth …` | Account recovery operations (run in-container; see docs) |

</details>

---

## 📐 Architecture

<details open>
<summary><b>Hooked Kernel Architecture</b></summary>

Atlantis uses a Hooked Kernel Architecture. The kernel provides base orchestration while plugins register into defined lifecycle phases: `Discovery → Boot → Route → Hook`

```mermaid
graph TB
    subgraph REPO["Repo Root"]
        PKGS["packages/"]
        P["plugins/"]
        T["themes/"]
    end

    subgraph KERNEL["Kernel (packages/)"]
        CORE[core]
        API[api]
        ADMIN[admin]
        FRONTEND[frontend]
        SDK[sdk]
    end

    subgraph RUNTIME["Runtime"]
        PM[Plugin Registry]
        SEC[Security Monitor]
        DB[Database Layer]
        INFRA["Infrastructure Layer\nCache · Queue · Storage · Email"]
    end

    PKGS --> KERNEL
    P -->|registers into| PM
    T -->|rendered by| FRONTEND
    KERNEL --> RUNTIME
    PM --> SEC
    PM --> DB
    PM --> INFRA
```

</details>

<details>
<summary><b>Layered Request Flow</b></summary>

```
Browser / API Client
        │
        ▼
  Reverse Proxy (Coolify/Traefik/Nginx) — TLS only
        │
        ▼
  Platform Gateway (packages/cli — routes by HOST from the site table)
        │
   ┌────┼────────────────────┬──────────────────┐
   │    │                    │                  │
   ▼    ▼                    ▼                  ▼
API Server               Admin (Next.js)    Frontend (Next.js)
(packages/api)           (packages/admin)   (packages/frontend)
   │                         │
   └────────────┬────────────┘
                │
                ▼
         Kernel Core
    (packages/core + sdk)
                │
    ┌───────────┼───────────┐
    │           │           │
    ▼           ▼           ▼
 Plugin      Security    Database
 Registry    Monitor     Layer
    │                       │
    ▼                       ▼
Domain Plugins          Drizzle ORM
(cms, ecommerce,        (SQLite / PostgreSQL)
 finance, ...)
```

</details>

---

## 🆚 Why Atlantis?

Atlantis is built for teams who need a complete, extensible application platform — not a CMS, not a bare framework, not a locked-in SaaS.

<details>
<summary><b>Full Comparison Matrix</b></summary>

| Feature | Atlantis | WordPress | Strapi | Payload | Ghost / Directus | NestJS / Express |
|:--------|:--------:|:---------:|:------:|:-------:|:----------------:|:----------------:|
| **Deployment Mode** | API / API+Admin / Full-Stack | Monolithic | Headless Only | Headless Only | Headless Only | API Only |
| **Architecture** | Modular Kernel + Plugins | PHP Monolith | Static Schema | Code-first Schema | Static Schema | Manual Structure |
| **Database Abstraction** | ✅ Extensible driver | MySQL locked | DB-agnostic | DB-agnostic | DB-agnostic | BYO |
| **Real-time WS** | ✅ Built-in | ❌ 3rd party | ❌ 3rd party | ❌ 3rd party | ❌ 3rd party | Manual |
| **Background Queues** | ✅ Built-in BullMQ/Local | ❌ WP-Cron | ❌ Custom | ❌ Custom | ❌ Manual | Manual |
| **Cache Layer** | ✅ Kernel-managed | ❌ Plugins | ❌ Manual | ❌ Manual | Partial | Manual |
| **Plugin Isolation** | ✅ Sandboxed + signed | Loose hooks | Loose | Loose | Loose | N/A |
| **Marketplace** | ✅ Built-in + self-hosted | ❌ External | ❌ No | ❌ No | ❌ No | N/A |
| **Upgradable Plugins/Core** | ✅ In-place upgrades | Manual | Manual | Manual | Manual | N/A |
| **RBAC** | ✅ Kernel built-in | Plugin | Basic | Basic | Basic | Manual |
| **MFA / TOTP** | ✅ Native | ❌ Plugin | ❌ Plugin | ❌ Plugin | ❌ Plugin | ❌ Manual |
| **AI Workflow Hooks** | ✅ Native | ❌ Plugin bloat | ❌ Custom | ❌ Custom | ❌ Manual | ❌ Manual |
| **7-Phase Migrations** | ✅ Atomic | ❌ Manual SQL | Partial | Partial | Partial | Manual |
| **Vendor Lock-In** | **Zero** | High | Medium | Medium | Medium | Low |

</details>

---

## 📂 Repository Structure

```bash
.
├── packages/
│   │  # Application kernel
│   ├── core/               # Kernel — plugin lifecycle, RBAC, security, migrations, i18n, versioning
│   ├── api/                # Express API server — REST controllers, routes, middleware, bootstrap
│   ├── admin/              # Next.js Admin panel — plugin-aware UI
│   ├── frontend/           # Next.js Frontend — theme rendering engine
│   ├── sdk/                # Public contract for plugins/themes — the ONLY import surface they may use
│   │  # Infrastructure providers (kernel-managed, swappable)
│   ├── auth/               # JWT sessions, refresh rotation, MFA/TOTP, API keys, SSO extensions
│   ├── database/           # Driver abstraction (SQLite/PostgreSQL), Drizzle integration, proxies
│   ├── cache/              # CacheManager — Redis / Memcached / in-memory
│   ├── email/              # EmailManager — SMTP / SendGrid / Mailgun / mock
│   ├── media/              # StorageManager + media pipeline — local / S3 / Cloudinary
│   ├── scheduler/          # Scheduled/background job execution
│   │  # AI & MCP
│   ├── ai/                 # Admin Assistant runtime — LLM clients, classifier, MCP tool packs
│   ├── mcp/                # MCP schema/registry/bridge primitives (shared by server + clients)
│   ├── mcp-server/         # Standalone MCP server binary (stdio + Streamable HTTP client)
│   │  # Standalone OOP stack (reusable outside Atlantis)
│   ├── reactor/            # Class-based React primitives — Reactor/PureReactor, @prop/@state/@bound/@watch, Enum
│   ├── next-build-codegen/             # Build-time companion — .view template compiler, 'use client' injection
│   ├── typescript-multiple-inheritance/              # TypeScript build tool — multiple inheritance, package aliases, real typecheck
│   ├── arch-guard/             # Architecture boundary enforcement — who may import what
│   │  # Distribution & tooling
│   ├── marketplace-client/ # Client for plugin/theme marketplace installs and updates
│   ├── plugins/            # Plugin loading/packaging support
│   ├── react/              # Legacy React bridge (being absorbed by reactor)
│   ├── next/               # Shared Next.js glue
│   ├── create/             # `npm create` scaffolder for new Fromcode apps
│   └── cli/                # Atlantis CLI tool
├── plugins/           # 🔌 Domain plugins (cms, ecommerce, finance, logistics, ...)
├── themes/            # 🎨 UI themes and layout bundles
├── appearance/        # 🎛️ Admin appearances — product consoles (nexora, tagiqx, ...)
├── deploy/            # Production compose files and the container entrypoint
├── starters/          # Local dev proxy and startup scripts
├── docker-compose.yml
├── Dockerfile
├── .env.example
└── package.json
```

---

## 📚 Resources & Support

| Resource | Link | Purpose |
|----------|------|---------|
| 🔒 Security Policy | [SECURITY.md](SECURITY.md) | Vulnerability reporting & security architecture |
| 📜 License | [LICENSE](LICENSE) | MIT License |
| 🛡️ Security Monitor | [packages/core/src/security/](packages/core/src/security/) | Threat orchestration source |
| 📦 SDK Contract | [packages/sdk/](packages/sdk/) | Plugin/theme public API |
| 🐛 Issues | [GitHub Issues](https://github.com/fromcode119/framework/issues) | Bug reports & feature requests |

---

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-cyan?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-orange?style=for-the-badge)](https://orm.drizzle.team/)

Built with ❤️ by [Fromcode](https://fromcode.com).

</div>
