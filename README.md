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

## What is Atlantis?

Atlantis is a production-hardened application kernel, not a CMS and not a locked-in SaaS. It handles
identity, security, migrations, queues, media, AI hooks, and real-time out of the box, while staying
completely modular and provider-agnostic at every layer. You build a SaaS product, a content
platform, a marketplace, or all of the above, without re-architecting between them.

**The framework in this repository is free and MIT-licensed.** Domain plugins — CMS, eCommerce,
Finance, Logistics, LMS, MLM and the rest — are separate commercial products, distributed through the
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
| **RBAC** | ✅ Kernel built-in | Plugin | Basic | Basic | Basic | Manual |
| **MFA / TOTP** | ✅ Native | ❌ Plugin | ❌ Plugin | ❌ Plugin | ❌ Plugin | ❌ Manual |
| **AI Workflow Hooks** | ✅ Native | ❌ Plugin bloat | ❌ Custom | ❌ Custom | ❌ Manual | ❌ Manual |
| **7-Phase Migrations** | ✅ Atomic | ❌ Manual SQL | Partial | Partial | Partial | Manual |
| **Vendor Lock-In** | **Zero** | High | Medium | Medium | Medium | Low |

</details>

Full write-up: **[Why Atlantis?](docs/comparison.md)**

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
(`GATEWAY_PORT`). Behind a proxy you already run, point it at the `gateway` service instead.

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
- 🗑️ **Erasure is a kernel capability** — Every plugin declares its own personal-data datasets; "delete my account" reaches all of them.
- 🎛️ **Admin appearances** — An installed appearance can replace the whole console for a product.
- 🏗️ **Zero Architecture Lock-In** — Run as API only, API + Admin, or Full Stack; swap any provider without touching business logic.
- 📊 **Atomic Migrations** — 7-phase database synchronization across core and all active plugins.
- 🛡️ **Kernel Security Loop** — Real-time threat detection, cryptographic plugin signing, audit logging.
- 🧱 **Plugin process isolation** — An isolated plugin runs in its own OS process with a heap ceiling and a per-call deadline; a crash takes down only that plugin.
- 📦 **Backups + Site Transfer** — Managed system backups and a repository-root site-transfer bundle command.
- 🌍 **Built-in i18n** — Per-field localization, admin UI labels, and plugin data, with no external libraries.
- 🕘 **Version History Everywhere** — Every admin edit of any plugin's record is snapshotted, with one-click restore.
- 🔀 **Framework-owned Redirects** — Redirect rules and canonical paths live in the kernel, no SEO plugin required.
- 🏛️ **Pure OOP Codebase** — Every layer is class-based; the UI layer runs on standalone `react-class-components`, `next-build-codegen` and `typescript-multiple-inheritance` packages.

See the [Architecture guide](docs/architecture.md) for how each of these actually works.

---

## 📐 Architecture

Atlantis uses a Hooked Kernel Architecture: the kernel provides base orchestration while plugins
register into lifecycle phases (`Discovery → Boot → Route → Hook`). Requests flow through a platform
gateway that routes by hostname to the API, Admin, or Frontend, all built on a shared kernel core
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
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-orange?style=for-the-badge)](https://orm.drizzle.team/)

Built with ❤️ by [Fromcode](https://fromcode.com).

</div>
