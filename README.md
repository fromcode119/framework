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

---

*Deploy specialized business domains as isolated, composable plugins — a hardened application kernel that orchestrates plugins, themes, and packages through a unified TypeScript monorepo with zero lock-in on any layer.*

</div>

## What is Atlantis?

Atlantis is a production-hardened application kernel, not a CMS and not a locked-in SaaS. It handles
identity, security, migrations, queues, media, AI hooks, and real-time out of the box, while staying
completely modular and provider-agnostic at every layer. You build a SaaS product, a content
platform, a marketplace, or all of the above, without re-architecting between them.

**The framework in this repository is free and MIT-licensed.** Domain plugins — content, commerce,
billing, shipping, courses and the rest — are separate commercial products, distributed through the
marketplace and not included here. Atlantis gives you the kernel and the plugin contract; what you
build on it is yours, and nothing obliges you to use our plugins at all.

## 🆚 Why Atlantis?

Traditional frameworks hand you raw materials but no system. CMS platforms lock you into their
schema. SaaS products lock you into their pricing. Atlantis is none of those.

<details>
<summary><b>📊 Full comparison — WordPress, Strapi, Payload, Ghost/Directus, NestJS/Express</b></summary>

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
| **Zero-downtime Deploys** | ✅ Rolling + built-in edge LB | ❌ Maintenance mode | ❌ Manual | ❌ Manual | ❌ Manual | Manual |
| **RBAC** | ✅ Kernel built-in | Plugin | Basic | Basic | Basic | Manual |
| **MFA / TOTP** | ✅ Native | ❌ Plugin | ❌ Plugin | ❌ Plugin | ❌ Plugin | ❌ Manual |
| **AI Workflow Hooks** | ✅ Native | ❌ Plugin bloat | ❌ Custom | ❌ Custom | ❌ Manual | ❌ Manual |
| **7-Phase Migrations** | ✅ Atomic | ❌ Manual SQL | Partial | Partial | Partial | Manual |
| **Vendor Lock-In** | **Zero** | High | Medium | Medium | Medium | Low |

</details>

Full write-up: **[Why Atlantis?](docs/comparison.md)**

## ⚡ Performance

Every number is **req/s** (requests per second) on one 2 vCPU / 4 GB server, same data, no response cache. Higher is faster; best in **bold**.

**Against the open-source backends** — the same six-field records on every platform:

| Operation (req/s) | Atlantis (plain record) | Payload | Directus | Strapi |
|:--|--:|--:|--:|--:|
| List of 20 records | **203.4** | 137.5 | 109.6 | 99.5 |
| One record by slug | **255.9** | 217.6 | 128.8 | 115.2 |
| Filtered + sorted (20) | **150.4** | 130.8 | 101.1 | 68.8 |
| Signed-in read (20) | **157.4** | 76.5 | 103.1 | 94.6 |
| Create a record | **84.7** | 58.9 | 76.5 | 76.2 |

**Against the commerce platforms** — Atlantis' own full shop product (94 columns, tax-aware prices, variants,
stock) against each platform's own product (Payload with its official e-commerce plugin):

| Operation (req/s) | Atlantis, full shop product | Payload + e-commerce plugin | PrestaShop | Magento | Drupal Commerce | WooCommerce | Medusa |
|:--|--:|--:|--:|--:|--:|--:|--:|
| Product list (20) | **92.2** | 58.2 | 14.7 | 9.8 | 9.3 | 6.2 | 13.7 |
| Single product | **214.6** | 98.2 | 54.1 | 12.8 | 12.4 | 21.0 | 25.6 |
| Filtered + sorted (20) | **66.8** | 30.2 | 14.9 | 10.3 | 8.9 | 10.7 | 16.2 |
| Signed-in read (20) | **119.0** | 52.7 | 51.7 | 6.4 | 4.3 | 7.7 | 10.5 |
| Create a record | **70.3** | 44.9 | 23.0 | 24.1 | 4.3 | 14.7 | 5.2 |

Atlantis is first in every row of every table, including at 36 fields per record where it stays 1.1× to 1.8×
ahead. Every number, the method, the data and what these results do **not** show are in
**[docs/benchmarks.md](docs/benchmarks.md)**; they come from one server run by the project, so please run your
own load before you choose.

---

## 🚀 Quick Start

Requires **Node.js 22+**, **npm 10+** and **Git**. Zero Docker, zero Postgres, zero Redis.

```bash
git clone https://github.com/fromcode119/framework.git
cd framework
npm install
cd starters/local
cp .env.example .env          # then set a real JWT_SECRET before going to production
npm install
npm run dev:api-admin
```

Open **`http://localhost:3000/admin/setup`**. The first-run wizard asks where your database is and
creates your administrator account — there is nothing to hand-edit before the first boot.

The wizard offers three drivers and tells you what each one costs:

| Driver | Sites | Notes |
|---|---|---|
| **PostgreSQL** *(recommended)* | many | Row-level security, three roles, backups. The only driver that can host more than one site. |
| **SQLite** | one | One file, no database server to run. Ideal for evaluating. |
| **MySQL** | one | Real roles and backups, but no row-level security — same limit as SQLite. |

> **Why the choice is permanent.** Tenancy here is one database with every row tagged `tenant_id`,
> isolated by PostgreSQL row-level security — there is no per-tenant database or schema. A driver
> without RLS is therefore not a slower way to be multi-tenant, it is single-site only, and the
> platform refuses to boot a second site rather than serving every tenant to every other one.

The wizard also sets your language, platform name and admin domain. It stays open for 15 minutes
after start and only for whoever reaches it first, so an exposed install cannot be claimed by a
passer-by.

**Prefer the fully containerized stack?** The bundled `docker-compose.yml` runs API + Admin +
Frontend + PostgreSQL with no local Node. Set `COMPOSE_PROFILES=single-domain` in `.env` and
`docker compose up -d` serves the whole platform on one hostname, port 80 by default
(`GATEWAY_PORT`). Behind a proxy you already run, point it at the `gateway` service instead. For a
production server, see [Deploying the framework](deploy/DEPLOYMENT.md) — prebuilt images, rolling
deploys and the edge.

**→ [Full installation guide](docs/installation.md)** — Docker Compose, production servers, Coolify,
manual image builds, and the routing shapes for multi-hostname deployments.

---

## 📚 Documentation

| Guide | Covers |
|---|---|
| [Installation](docs/installation.md) | Every install path: Docker Compose, production server, local dev, Coolify, manual images |
| [Configuration](docs/configuration.md) | Every environment variable — core, database, cache/queue/storage/email, multi-site, rate limiting |
| [Architecture](docs/architecture.md) | Hooked kernel design, request flow, kernel subsystems, repository structure |
| [Comparison — Why Atlantis?](docs/comparison.md) | Feature-by-feature vs. WordPress, Strapi, Payload, Ghost/Directus, NestJS/Express |
| [Build & CLI](docs/cli.md) | Build commands, architecture-check gates, the `atlantis` CLI, run modes |
| [MCP Server](docs/mcp-server.md) | Every install as a Model Context Protocol server — security model, tools, connecting Claude |
| [Plugin Development](docs/plugin-development-guide.md) | Plugin ecosystem, plugin structure, cross-plugin communication, collections, hooks |
| [API Reference](docs/api-reference.md) | REST and GraphQL APIs |
| [Certificates and TLS](docs/certificates-and-tls.md) | HTTPS, certificate uploads, expiry warnings |
| [Site Visibility and Preview](docs/site-visibility-and-preview.md) | Private/unlisted/public sites, previewing before launch |
| [Running Plugins You Don't Fully Trust](docs/untrusted-plugins.md) | What stops a bad plugin from taking over the server, and the operator's checklist |
| [Backup and Site Transfer](docs/backup-and-transfer.md) | System backups, restore, site-transfer bundles |
| [Full documentation index](docs/README.md) | Every guide, including the module and package docs |

---

## ✨ Features

- 🔐 **Built-in RBAC + MFA** — Users, Roles, Permissions, TOTP 2FA, recovery codes in the kernel.
- 🎫 **Auth that covers real deployments** — JWT sessions with refresh rotation, API keys, and SSO with a JWKS key provider.
- 🔊 **Real-time built in** — A kernel WebSocket manager, not a bolted-on third-party service.
- 🪝 **Webhooks with delivery tracking** — Outbound webhooks are a kernel service with their own delivery records.
- 🗄️ **Swap the database** — PostgreSQL, MySQL and SQLite dialects behind one registry; drivers are extensible.
- 🧩 **Plugin Ecosystem** — Domain plugins register into the kernel lifecycle; cross-plugin communication only through the kernel context.
- 🏪 **Plugin Marketplace** — Install plugins from the built-in marketplace, or host your own private one. Plugins and core upgrade in place without breaking changes.
- ⚡ **Unified Infrastructure** — One kernel manages Cache, Queue, Email, and Storage for all plugins.
- 🤖 **AI Out of the Box** — LLM hooks (OpenAI, Anthropic, Ollama), vector operations, content pipelines.
- 🔧 **Built-in MCP Server** — Every installation is an [MCP](https://modelcontextprotocol.io) server for AI agents, gated by scoped tokens minted in the admin.
- 🏢 **Multi-site, one platform** — Many customer sites from one deployment, isolated twice: by the application and by PostgreSQL row-level security.
- 👁️ **Private until you publish** — A new site is closed by default; **Preview** opens visibility to a site's own people without an account or a role.
- 🌐 **Framework-owned edge** — The platform gateway routes every hostname from the site table; creating a site is live within a second.
- 🔒 **TLS certificates in the admin** — A certificate is a record in the platform, with automatic expiry warnings.
- 📇 **Contact details hidden from harvesters** — Email addresses and phone numbers (international numbers, and anything in a `tel:` link) leave the server encoded: in the page text, in `mailto:`/`tel:` links, and in the page data scripts carry. The browser puts them back just before hydration, so visitors see and click them as normal and the page still hydrates from its server render — unlike a CDN's email obfuscation, which rewrites the HTML after rendering and breaks hydration. Automatic for every theme and plugin, one switch per site (**Settings → Security → Contact Details**).
- 🗑️ **Erasure is a kernel capability** — Every plugin declares its own personal-data datasets; "delete my account" reaches all of them.
- 🎛️ **Admin appearances** — An installed appearance can replace the whole console for a product.
- 🏗️ **Zero Architecture Lock-In** — Run as API only, API + Admin, or Full Stack; swap any provider without touching business logic.
- 📊 **Atomic Migrations** — 7-phase database synchronization across core and all active plugins.
- 🛡️ **Kernel Security Loop** — Real-time threat detection, cryptographic plugin signing, audit logging.
- 🧱 **Plugin process isolation** — An isolated plugin runs in its own OS process with a heap ceiling and a per-call deadline; a crash takes down only that plugin.
- 🧯 **A bad plugin breaks one site, not the server** — A plugin a site uploads runs as its own user with no network, no secrets and only a short list of SDK calls, held to CPU, memory, disk and process limits, in a sandbox container of its own that can run under gVisor ([what to do](#-running-plugins-you-dont-fully-trust)).
- 🔁 **Rolling updates, zero gap** — A release replaces the api, admin, storefront and gateway one at a time: the new container starts beside the old one, takes traffic once it answers, and the old one drains its in-flight requests before it stops. No failed request, no maintenance window ([how](deploy/DEPLOYMENT.md#how-a-release-replaces-the-running-platform)).
- ⚖️ **Built-in edge load balancer** — The platform's own `edge` holds ports 80/443 and spreads connections across every running gateway (least-busy first, health-checked every second, a refusing gateway is skipped and the request retried on another), passing the visitor's real address on with the PROXY protocol. Prefer HAProxy or another proxy? Point `EDGE_IMAGE`/`EDGE_COMMAND` at it — a ready HAProxy config ships in `deploy/edge/haproxy` ([the edge](deploy/DEPLOYMENT.md#the-edge)).
- 🔌 **Plugins survive deploys** — Plugin processes live in the optional `extension-host` container; a new api takes the running processes over instead of restarting them, and the admin shows where each one runs and what it registered.
- 📦 **Backups + Site Transfer** — Managed system backups and a repository-root site-transfer bundle command.
- 🌍 **Built-in i18n** — Per-field localization, admin UI labels, and plugin data, with no external libraries.
- 🕘 **Version History Everywhere** — Every admin edit of any plugin's record is snapshotted, with one-click restore.
- 🔀 **Framework-owned Redirects** — Redirect rules and canonical paths live in the kernel, no plugin required.
- 🏛️ **Pure OOP Codebase** — Every layer is class-based; the UI layer runs on standalone `react-class-components`, `next-build-codegen` and `typescript-multiple-inheritance` packages.

See the [Architecture guide](docs/architecture.md) for how each of these actually works.

---

## 🛡️ Running plugins you don't fully trust

On most platforms one bad plugin is enough: the site sends spam, every other site on the server is
defaced, and the hosting account changes hands. Here the boundary is one site. A plugin a site uploads
gets no network, no secrets and no database of its own, may call only a short list of SDK methods, and
is held to CPU, memory, disk and process limits in a sandbox container of its own — and site uploads
are off until a platform administrator turns them on.

What stays your job, on any deployment:

1. **Patch the server's kernel** and turn on automatic security updates — it is the one thing every
   plugin process shares.
2. **Run site plugins under a sandboxing runtime** such as [gVisor](https://gvisor.dev)
   (`SITE_PLUGIN_RUNTIME`), so a kernel flaw lands in the sandbox, not on the server.
3. **Leave site uploads off** unless a site needs them, and **install platform plugins only from
   sources you trust** — they are part of the platform.
4. **Require reviewed pull requests** on the repositories you build from, and keep backups you have
   restored at least once.

The full guide — every protection, every limit, and what no platform can do for you — is
[Running Plugins You Don't Fully Trust](docs/untrusted-plugins.md).

---

## 📐 Architecture

Atlantis uses a Hooked Kernel Architecture: the kernel provides base orchestration while plugins
register into lifecycle phases (`Discovery → Boot → Route → Hook`). Requests enter through the platform's
`edge` (a TCP load balancer across gateway replicas), then a platform gateway that routes by hostname to the API, Admin, or Frontend, all built on a shared kernel core
(`packages/core` + `packages/sdk`) that owns security, the database layer, and multi-site isolation.

**→ [Full architecture guide](docs/architecture.md)** — diagrams, kernel subsystems, and the
repository structure.

---

## 🤝 Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, the
checks a change must pass, branch/commit conventions, and how pull requests are merged. This project
follows the [Contributor Covenant](CODE_OF_CONDUCT.md).

---

## 📜 License

Atlantis is [MIT licensed](LICENSE). See [SECURITY.md](SECURITY.md) for reporting a vulnerability.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&logo=opensourceinitiative)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-cyan?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)

Built with ❤️ by [Fromcode](https://fromcode.com).

</div>
