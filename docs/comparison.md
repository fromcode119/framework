# Why Fromcode Framework?

Fromcode Framework is built for teams who need a complete, extensible application platform — not a CMS, not a bare framework, not a locked-in SaaS.

Traditional frameworks hand you raw materials but no system. CMS platforms lock you into their
schema. SaaS products lock you into their pricing. Fromcode Framework is none of those — it's a
production-hardened application kernel that handles identity, security, migrations, queues, media,
AI hooks, and real-time out of the box, while remaining completely modular and provider-agnostic at
every layer. Build a SaaS product, a content platform, a marketplace, a logistics system, or all of
the above — without re-architecting between them.

## Where the kernel goes further

| Feature | Fromcode Framework | WordPress | Strapi | Payload | Directus | NestJS |
|:--------|:--------:|:--------:|:--------:|:--------:|:--------:|:--------:|
| **Plugins in their own OS process** | ✅ Isolated plugins: a crash stops only that plugin | — | — | — | Sandbox inside the same process | — |
| **A site uploads its own plugin, sandboxed** | ✅ Own user, no network, CPU, memory and disk limits | — | — | — | Marketplace sandbox with memory and time limits | n/a |
| **Under-attack mode and country blocking** | ✅ At the gateway (off by default) | — | IP allow and block lists | — | IP allow list | Rate-limit module |
| **TLS certificates in the admin, expiry warnings** | ✅ | Your hosting | Your hosting | Your hosting | Your hosting | Paid platform |
| **Load balancer and zero-gap releases, self-hosted** | ✅ | Your hosting | Your hosting | Your hosting | Your hosting | Paid platform |
| **Many sites, isolated in the database** | ✅ PostgreSQL row-level security | Multisite: own tables per site | Community plugins | Official plugin, access rules | — | Your code |
| **Your own private marketplace** | ✅ Point the admin at your catalogue | — | — | — | Configurable registry address | n/a |
| **Only pull-request-merged code is built from Git** | ✅ GitHub signature checked (can be allowed otherwise) | — | — | — | — | n/a |
| **Encrypted credentials only their plugin opens** | ✅ | — | — | Shared app key | — | — |
| **Emails and phones hidden from harvesters** | ✅ Every theme and plugin | Comment emails | — | — | — | n/a |
| **Account erasure that reaches every plugin** | ✅ | ✅ | — | — | — | — |
| **Version history and restore, no setup** | ✅ Every admin and API edit | Post types with revisions | Paid plans | Opt-in per collection | ✅ Retention depends on plan | — |
| **One page of all scheduled jobs and every run** | ✅ | — | — | Job records, hidden by default | Logs per flow | Hosted add-on |
| **Outgoing webhooks with a delivery log** | ✅ | — | Webhooks, no log | — | Flow logs | Official library |
| **Redirect rules in the core** | ✅ | Automatic old-address redirects | — | Official plugin | — | — |
| **New site private, preview without accounts** | ✅ | Public by default | Private content by default | Login required by default | Share links for single items | n/a |
| **Replace the whole admin with an installable one** | ✅ Appearances | Color schemes | Theming and code | Components in code | Themes and app extensions | n/a |
| **Backups with restore, and moving a site** | ✅ | Content export | CLI transfer; admin restore in their cloud | CSV/JSON per collection | Data and schema export | n/a |
| **Native app sign-in (Apple, Google) and push** | ✅ Including in-app account deletion | — | Google web sign-in | Your own strategy | Web single sign-on (licensed) | Google token library |
| **Admin audit log** | ✅ | — | Paid plans | Paid plans | ✅ Retention depends on plan | — |

## Common ground

| Feature | Fromcode Framework | WordPress | Strapi | Payload | Directus | NestJS |
|:--------|:--------:|:--------:|:--------:|:--------:|:--------:|:--------:|
| **What it is** | Application framework: API, API + admin, or full stack | Full-stack CMS | Headless CMS | Next.js full-stack framework and CMS | Backend and admin app over a SQL database | Server framework |
| **Databases** | PostgreSQL, MySQL, SQLite | MySQL, MariaDB | PostgreSQL, MySQL, MariaDB, SQLite | MongoDB, PostgreSQL, SQLite | PostgreSQL, MySQL, MariaDB, SQLite, MS SQL, CockroachDB, Oracle | Your choice |
| **Real-time WebSockets** | Built in | Plugin | Plugin | Plugin | Built in (opt-in when self-hosted) | Official module |
| **Background jobs** | Built-in queues (BullMQ or local) | Built-in scheduler | Built-in cron (opt-in) | Built-in jobs queue | Scheduled flows | Official module |
| **Two-factor sign-in** | Built in (TOTP) | Plugin | Plugin, or SSO on paid plans | Plugin | Built in (TOTP) | Your code |
| **Roles and access control** | Built in | Built in | Built in | Built in | Built in | Guards |
| **Adding extensions** | Marketplace in the admin | Plugin directory in the admin | Marketplace in the admin | npm packages | Marketplace in the admin | npm packages |
| **Translated content fields** | Built in | Plugin | Built in (opt-in) | Built in (opt-in) | Built in | Message translation library |
| **AI for extensions** | Built in | Core AI client, providers added | Paid plans | Paid plans or plugins | Built-in assistant | Official library |
| **MCP server for AI agents** | Built in | Official add-on | Built in (opt-in) | Official plugin | Built in (opt-in) | Official library |

Competitor entries were read on 27 November 2026. "—" means we found no built-in equivalent in that project's
documentation; third-party plugins may add it. Versions and plans change, so check the project you are weighing:

- WordPress: [requirements](https://wordpress.org/about/requirements/), [roles](https://wordpress.org/documentation/article/roles-and-capabilities/), [cron](https://developer.wordpress.org/plugins/cron/), [plugins](https://wordpress.org/documentation/article/manage-plugins/), [Multisite tables](https://codex.wordpress.org/Database_Description), [plugin access](https://core.trac.wordpress.org/ticket/63304), [comment email hiding](https://developer.wordpress.org/reference/functions/antispambot/), [personal data erasure](https://developer.wordpress.org/plugins/privacy/adding-the-personal-data-eraser-to-your-plugin/), [revisions](https://developer.wordpress.org/reference/functions/wp_revisions_to_keep/), [old-address redirects](https://developer.wordpress.org/reference/functions/wp_old_slug_redirect/), [export](https://wordpress.org/documentation/article/tools-export-screen/), [multilingual](https://developer.wordpress.org/advanced-administration/wordpress/multilingual/), [AI client](https://make.wordpress.org/core/2026/03/24/introducing-the-ai-client-in-wordpress-7-0/), [MCP adapter](https://developer.wordpress.org/news/2026/02/from-abilities-to-ai-agents-introducing-the-wordpress-mcp-adapter/)
- Strapi: [databases](https://docs.strapi.io/cms/configurations/database), [cron](https://docs.strapi.io/cms/configurations/cron), [roles](https://docs.strapi.io/cms/features/rbac), [two-factor options](https://strapi.io/blog/strapi-admin-panel-mfa-2fa), [marketplace](https://docs.strapi.io/cms/plugins/installing-plugins-via-marketplace), [multi-tenancy plugin](https://github.com/AlvaroVeloso070/strapi-plugin-multitenancy), [IP middleware](https://docs.strapi.io/cms/configurations/middlewares), [content history](https://docs.strapi.io/cms/features/content-history), [webhooks](https://docs.strapi.io/cms/backend-customization/webhooks), [permissions](https://docs.strapi.io/cms/features/users-permissions), [admin customization](https://docs.strapi.io/cms/admin-panel-customization), [data management](https://docs.strapi.io/cms/features/data-management), [sign-in providers](https://docs.strapi.io/cms/configurations/users-and-permissions-providers), [translation](https://docs.strapi.io/cms/features/internationalization), [AI plans](https://strapi.io/pricing-self-hosted), [MCP](https://docs.strapi.io/cms/features/strapi-mcp-server), [audit logs](https://docs.strapi.io/cms/features/audit-logs)
- Payload: [overview](https://payloadcms.com/docs/getting-started/what-is-payload), [databases](https://payloadcms.com/docs/getting-started/concepts), [jobs](https://payloadcms.com/docs/jobs-queue/jobs), [multi-tenant plugin](https://payloadcms.com/docs/plugins/multi-tenant), [plugins](https://payloadcms.com/docs/plugins/overview), [versions](https://payloadcms.com/docs/versions/overview), [secrets](https://payloadcms.com/docs/authentication/overview), [redirects](https://payloadcms.com/docs/plugins/redirects), [access control](https://payloadcms.com/docs/access-control/overview), [custom components](https://payloadcms.com/docs/custom-components/overview), [import and export](https://payloadcms.com/docs/plugins/import-export), [custom sign-in](https://payloadcms.com/docs/authentication/custom-strategies), [localization](https://payloadcms.com/docs/configuration/localization), [enterprise](https://payloadcms.com/enterprise), [MCP](https://payloadcms.com/docs/plugins/mcp)
- Directus: [databases](https://directus.com/docs/self-hosting/requirements), [real-time](https://directus.com/docs/configuration/realtime), [flows](https://directus.com/docs/guides/flows/triggers), [marketplace](https://directus.com/docs/guides/extensions/marketplace), [registry setting](https://directus.com/docs/configuration/extensions), [sandbox](https://directus.com/docs/guides/extensions/api-extensions/sandbox), [access control](https://directus.com/docs/guides/auth/access-control), [versioning](https://directus.com/docs/guides/content/content-versioning), [logs](https://directus.com/docs/configuration/logging), [pricing](https://directus.com/pricing), [shares](https://directus.com/docs/api/shares), [themes](https://directus.com/docs/guides/extensions/app-extensions/themes), [single sign-on](https://directus.com/docs/configuration/auth-sso), [translations](https://directus.com/docs/guides/content/translations), [MCP](https://directus.com/docs/guides/ai/mcp/installation)
- NestJS: [queues](https://docs.nestjs.com/techniques/queues), [gateways](https://docs.nestjs.com/websockets/gateways), [authorization](https://docs.nestjs.com/security/authorization), [rate limiting](https://docs.nestjs.com/security/rate-limiting), [deployment platform](https://docs.nestjs.com/deployment), [job dashboard](https://docs.nestjs.com/observability/dashboard), [webhooks](https://docs.nestjs.com/http/webhooks), [Google sign-in](https://docs.nestjs.com/tutorials/google-login), [translation](https://docs.nestjs.com/application/i18n), [AI](https://github.com/nestjs/ai), [MCP](https://github.com/nestjs/mcp)
