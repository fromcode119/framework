# Why Atlantis?

Atlantis is built for teams who need a complete, extensible application platform — not a CMS, not a bare framework, not a locked-in SaaS.

Traditional frameworks hand you raw materials but no system. CMS platforms lock you into their
schema. SaaS products lock you into their pricing. Atlantis is none of those — it's a
production-hardened application kernel that handles identity, security, migrations, queues, media,
AI hooks, and real-time out of the box, while remaining completely modular and provider-agnostic at
every layer. Build a SaaS product, a content platform, a marketplace, a logistics system, or all of
the above — without re-architecting between them.

## Full Comparison Matrix

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
