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
4. Add a GitHub webhook: repo → Settings → Webhooks → Payload URL from Coolify → `application/json` → push event
5. Deploy

---

### Key Capabilities

🔐 **Built-in RBAC + MFA** — Users, Roles, Permissions, TOTP 2FA, and recovery codes baked directly into the kernel. No plugin required.

🧩 **Plugin Ecosystem** — Domain plugins (CMS, eCommerce, Finance, Logistics, LMS, MLM, Forms, SEO, Analytics, Privacy, and more) register themselves into kernel lifecycle phases. Install from the marketplace or build your own.

⚡ **Unified Infrastructure** — One kernel manages Cache (Redis/Memcached/In-Memory), Queue (BullMQ/Local), Email (SMTP/SendGrid/Mailgun), and Storage (S3/Cloudinary/Local) for all plugins.

🤖 **AI Out of the Box** — First-class LLM hooks for OpenAI, Anthropic, Ollama and compatible APIs, plus vector operations and content pipeline hooks, are built into the kernel — no extra setup, no third-party wiring.

🏗️ **Zero Architecture Lock-In** — Run as API only, API + Admin, or Full Stack. Swap any provider (DB, cache, storage, email, queue) without touching business logic.

📊 **Atomic Migrations** — 7-phase database synchronization system handles schema updates across core and all active plugins atomically.

🛡️ **Kernel Security Loop** — Real-time threat detection, plugin sandboxing with cryptographic signature verification, and comprehensive audit logging built into the kernel.

🏪 **Plugin Marketplace** — Install plugins from the built-in marketplace. Every team can host their own private marketplace. Plugins and core are upgradable in place without breaking changes.

� **Built-in i18n** — Multi-language support is a first-class kernel feature. Localize content, admin UI labels, and plugin data without external libraries.

�🏛️ **Pure OOP Codebase** — Every layer is class-based. No standalone exported functions anywhere. Routers extend `BaseRouter`, middlewares extend `BaseMiddleware`, utilities live in service classes. Consistent, predictable, and fully tree-shakable.

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

#### 3. Install and migrate

```bash
npm install
npm run fromcode -- migrate:push
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
2. Point it to the `docker-compose.yml` at the repo root
3. Set all required **Environment Variables** in the Coolify dashboard

#### 3. Set the deployment mode

Configure `DEPLOYMENT_MODE` in Coolify environment variables:

| Mode | Value | What runs |
|------|-------|-----------|
| Full Stack | `full` | API + Admin + Frontend |
| API + Admin | `api-admin` | API + Admin only |
| API Only | `api` | Bare API — headless |

#### 4. Deploy

Click **Deploy** in Coolify. Fromcode will install plugin dependencies, run migrations, and start. Coolify handles zero-downtime rolling updates and automatic TLS provisioning.

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
| `DB_DIALECT` | `postgres` | `sqlite` or `postgres` |
| `DATABASE_URL` | `file:./data/app.db` | Full DB connection string |
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

> SQLite works out of the box for local development with zero setup. Switch to PostgreSQL for production.

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
<summary><b>Rate Limiting, Security & Plugins</b></summary>

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `PLUGINS_DIR` | `./plugins` | Path to plugins directory |
| `THEMES_DIR` | `./themes` | Path to themes directory |
| `MARKETPLACE_URL` | `https://marketplace.fromcode.com/marketplace.json` | Plugin marketplace feed |

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
| **Plugin Sandboxing** | Execution-level isolation via `SandboxManager`. Plugins run with declared capabilities only. |
| **Cryptographic Signing** | Plugin signature verification on load. Unsigned or tampered plugins are rejected. |
| **Audit Logging** | Comprehensive audit trail via `AuditManager` for every admin action, login, and permission change. |
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
| **SQLite (default)** | Zero-setup for local development. `DB_DIALECT=sqlite` just works. |
| **PostgreSQL** | Production-ready. Set `DB_DIALECT=postgres` and update `DATABASE_URL`. |
| **Drizzle ORM** | Default query builder. Full TypeScript inference for schema and queries. |
| **7-Phase Migrations** | Atomic migration orchestration across core and all active plugins simultaneously. Schema changes are coordinated, not scattered. |

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

The following plugins will be available in the ecosystem. You can install them from the marketplace, build your own, or host a private marketplace for your team.

| Slug | Domain | Purpose |
|------|--------|---------|
| `cms` | Content | Headless CMS with block editor, pages, navigation, and collections |
| `ecommerce` | Commerce | Product registry, variant management, carts, and checkout flows |
| `finance` | Ledger | Unified transaction engine, pricing, and revenue ledger |
| `logistics` | Delivery | Shipping providers, fulfillment tracking, and carrier integration |
| `forms` | Capture | Form builder, submission management, and webhook dispatch |
| `analytics` | Insights | Event tracking, dashboards, and traffic analytics |
| `seo` | Discoverability | Meta management, sitemaps, structured data, and redirects |

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
# Check plugin layer violations (warn mode)
npm run check:plugin-architecture

# Strict mode — fail on any violation
npm run check:plugin-architecture:strict

# SDK boundary audit
npm run check:sdk-boundary
npm run audit:core-boundary
```

</details>

<details>
<summary><b>The Atlantis CLI</b></summary>

```bash
npm run fromcode -- <command>
```

| Command | Description |
|---------|-------------|
| `plugin:create` | Scaffold a new plugin with the correct structure in `plugins/` |
| `theme:create` | Scaffold a new theme in `themes/` |
| `migrate:push` | Atomic schema synchronization across all active plugins |
| `security:audit` | Verify plugin signatures and declared capability sets |
| `seed:theme` | Seed theme configuration data |

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
  Local Proxy (dev) or Reverse Proxy (Coolify/Nginx)
        │
   ┌────┴────────────────────┐
   │                         │
   ▼                         ▼
API Server               Admin (Next.js)
(packages/api)           (packages/admin)
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
│   ├── api/           # Express API server — routes, middleware, bootstrap
│   ├── admin/         # Next.js Admin panel — plugin-aware UI
│   ├── frontend/      # Next.js Frontend — theme rendering engine
│   ├── core/          # Kernel — RBAC, security, migrations, services
│   ├── sdk/           # Public contract for plugins/themes
│   └── cli/           # Atlantis CLI tool
├── plugins/           # 🔌 Domain plugins (cms, ecommerce, finance, logistics, ...)
├── themes/            # 🎨 UI themes and layout bundles
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
