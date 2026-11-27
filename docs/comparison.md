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
| **Adding extensions** | Built-in marketplace, public or your own | Plugin directory in the admin | Marketplace in the admin | npm packages | Marketplace in the admin | npm packages |

Competitor entries were read on 27 November 2026. Versions change, so check the project you are weighing:

- WordPress: [requirements](https://wordpress.org/about/requirements/), [roles](https://wordpress.org/documentation/article/roles-and-capabilities/), [cron](https://developer.wordpress.org/plugins/cron/), [plugins](https://wordpress.org/documentation/article/manage-plugins/)
- Strapi: [databases](https://docs.strapi.io/cms/configurations/database), [cron](https://docs.strapi.io/cms/configurations/cron), [RBAC](https://docs.strapi.io/cms/features/rbac), [two-factor options](https://strapi.io/blog/strapi-admin-panel-mfa-2fa), [marketplace](https://docs.strapi.io/cms/plugins/installing-plugins-via-marketplace)
- Payload: [overview](https://payloadcms.com/docs/getting-started/what-is-payload), [databases](https://payloadcms.com/docs/getting-started/concepts), [jobs queue](https://payloadcms.com/docs/jobs-queue/overview)
- Directus: [databases](https://directus.com/docs/self-hosting/requirements), [real-time](https://directus.com/docs/configuration/realtime), [flows](https://directus.com/docs/guides/flows/triggers), [marketplace](https://directus.com/docs/guides/extensions/marketplace)
- NestJS: [queues](https://docs.nestjs.com/techniques/queues), [gateways](https://docs.nestjs.com/websockets/gateways), [authorization](https://docs.nestjs.com/security/authorization)
