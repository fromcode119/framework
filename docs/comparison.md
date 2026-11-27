# Why Fromcode Framework?

Fromcode Framework is built for teams who need a complete, extensible application platform — not a CMS, not a bare framework, not a locked-in SaaS.

Traditional frameworks hand you raw materials but no system. CMS platforms lock you into their
schema. SaaS products lock you into their pricing. Fromcode Framework is none of those — it's a
production-hardened application kernel that handles identity, security, migrations, queues, media,
AI hooks, and real-time out of the box, while remaining completely modular and provider-agnostic at
every layer. Build a SaaS product, a content platform, a marketplace, a logistics system, or all of
the above — without re-architecting between them.

## Full Comparison Matrix

| Feature | Fromcode Framework | WordPress | Strapi | Payload | Directus | NestJS |
|:--------|:--------:|:---------:|:------:|:-------:|:--------:|:------:|
| **What it is** | Application framework: API, API + admin, or full stack | Full-stack CMS | Headless CMS | Next.js full-stack framework and CMS | Backend and admin app over a SQL database | Server framework |
| **Databases** | PostgreSQL, MySQL, SQLite | MySQL, MariaDB | PostgreSQL, MySQL, MariaDB, SQLite | MongoDB, PostgreSQL, SQLite | PostgreSQL, MySQL, MariaDB, SQLite, MS SQL, CockroachDB, Oracle | Your choice |
| **Real-time WebSockets** | Built in | Plugin | Plugin | Plugin | Built in (opt-in when self-hosted) | Official module |
| **Background jobs** | Built-in queues (BullMQ or local) | Built-in scheduler (WP-Cron) | Built-in cron (opt-in) | Built-in jobs queue | Scheduled flows | Official BullMQ module |
| **Two-factor sign-in** | Built in (TOTP) | Plugin | Plugin, or SSO on paid plans | Plugin | Built in (TOTP) | Your code |
| **Roles and access control** | Built in | Built in | Built in | Built in | Built in | Guards (official guide) |
| **Adding extensions** | Marketplace in the admin | Plugin directory in the admin | Marketplace in the admin | npm packages | Marketplace in the admin | npm packages |
| **Your own private marketplace** | Built in: point the admin at your catalogue | — | — | — | Configurable registry address | — |
| **Many sites in one install** | Built in, isolated by PostgreSQL row-level security | Multisite: own tables per site | Community plugins | Official plugin, access rules | — | Your code |
| **Resource limits on plugins** | CPU, memory, disk and time limits for isolated and site-uploaded plugins | — | — | — | Sandboxed API extensions | — |
| **Visitor protection** | Built in at the gateway: under-attack mode, request limit, country and address blocking | — | — | — | Request limit (off by default) | Official rate-limiting module |
| **Load balancer, zero-gap releases, TLS certificates in the admin** | Built in | Your hosting or proxy | Your hosting or proxy | Your hosting or proxy | Your hosting or proxy | Your hosting or proxy |

Competitor entries were read on 27 November 2026. "—" means we found no built-in equivalent in that project's
documentation. Versions change, so check the project you are weighing:

- WordPress: [requirements](https://wordpress.org/about/requirements/), [roles](https://wordpress.org/documentation/article/roles-and-capabilities/), [cron](https://developer.wordpress.org/plugins/cron/), [plugins](https://wordpress.org/documentation/article/manage-plugins/), [Multisite tables](https://codex.wordpress.org/Database_Description), [plugin access](https://core.trac.wordpress.org/ticket/63304)
- Strapi: [databases](https://docs.strapi.io/cms/configurations/database), [cron](https://docs.strapi.io/cms/configurations/cron), [RBAC](https://docs.strapi.io/cms/features/rbac), [two-factor options](https://strapi.io/blog/strapi-admin-panel-mfa-2fa), [marketplace](https://docs.strapi.io/cms/plugins/installing-plugins-via-marketplace), [multi-tenancy plugin](https://github.com/AlvaroVeloso070/strapi-plugin-multitenancy)
- Payload: [overview](https://payloadcms.com/docs/getting-started/what-is-payload), [databases](https://payloadcms.com/docs/getting-started/concepts), [jobs queue](https://payloadcms.com/docs/jobs-queue/overview), [multi-tenant plugin](https://payloadcms.com/docs/plugins/multi-tenant), [plugins](https://payloadcms.com/docs/plugins/overview)
- Directus: [databases](https://directus.com/docs/self-hosting/requirements), [real-time](https://directus.com/docs/configuration/realtime), [flows](https://directus.com/docs/guides/flows/triggers), [marketplace](https://directus.com/docs/guides/extensions/marketplace), [registry setting](https://directus.com/docs/configuration/extensions), [sandbox](https://directus.com/docs/guides/extensions/api-extensions/sandbox), [rate limiter](https://directus.com/docs/configuration/security-limits)
- NestJS: [queues](https://docs.nestjs.com/techniques/queues), [gateways](https://docs.nestjs.com/websockets/gateways), [authorization](https://docs.nestjs.com/security/authorization), [rate limiting](https://docs.nestjs.com/security/rate-limiting)
