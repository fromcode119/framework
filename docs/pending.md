# Pending Work

*Last updated: February 23, 2026*

---

## Phase 7 — Theme System (1 item)

- [ ] **Multi-Framework Support** — UI components for different frontend frameworks (Vue, Svelte, etc.)

---

## Phase 9 — Multi-Tenancy & Multi-Store (0% — never started)

### Tenant Isolation
- [ ] **Database Isolation Strategies** — Schema-per-tenant, DB-per-tenant, row-level security
- [ ] **Tenant Context** — Automatic tenant detection and context injection per request
- [ ] **Tenant Configuration** — Per-tenant settings and feature flags
- [ ] **Tenant Middleware** — Request routing based on domain/subdomain
- [ ] **Tenant Migration** — Tools for moving tenants between databases

### Multi-Store Architecture
- [ ] **Store Entity** — Multiple stores per tenant with independent settings
- [ ] **Store Detection** — Domain-based or path-based store routing
- [ ] **Shared Resources** — Products, users, orders across stores
- [ ] **Store-Specific Content** — Localized content per store
- [ ] **Cross-Store Analytics** — Unified reporting across all stores

### Tenant Management UI
- [ ] **Tenant Admin UI** — Create, configure, and manage tenants
- [ ] **Tenant Provisioning** — Automated onboarding and setup
- [ ] **Tenant Billing** — Usage tracking and billing per tenant
- [ ] **Tenant Limits** — Resource quotas and feature restrictions
- [ ] **Tenant Backup/Restore** — Isolated backup per tenant

### Tenant-Aware Plugins
- [ ] **Automatic Tenant Context** — All plugins receive tenant context automatically
- [ ] **Tenant-Scoped Data** — DB queries filtered by tenant ID
- [ ] **Tenant-Specific Config** — Per-tenant plugin configuration
- [ ] **Cross-Tenant Features** — Optional data sharing between tenants

---

## Phase 10 — Deployment & DevOps

### Infrastructure
- [ ] **Configuration Presets** — Development, staging, production config profiles
- [ ] **Service Orchestration** — Automatic service startup order by deployment mode
- [ ] **Health Checks** — `/health` path is excluded from rate limiting but no actual route handler exists; needs real endpoint + Docker HEALTHCHECK
- [ ] **Read Replicas** — Support for read-only DB replicas

### Caching & CDN
- [x] **Redis Integration** — `packages/cache` with `CacheFactory`/`CacheManager`, Redis + memory drivers; API server auto-selects Redis when `REDIS_URL` is set
- [ ] **CDN Integration** — Asset serving via CDN (Cloudflare, AWS CloudFront)
- [ ] **Edge Caching** — Deploy frontend to edge locations (Vercel, Cloudflare)
- [ ] **Query Caching** — Cache layer exists (`packages/cache`) but not wired to REST response caching
- [ ] **Static Site Generation** — Pre-render pages at build time

### Monitoring & Observability
- [ ] **Logging Integration** — Logger exists (`packages/sdk/logging.ts`) but is console-only; needs file transport or external service (Sentry, Datadog, Logtail)
- [ ] **Error Tracking** — Sentry integration
- [ ] **Performance Monitoring** — APM integration (Datadog, New Relic)
- [ ] **Metrics Collection** — Prometheus-compatible metrics endpoint
- [ ] **Distributed Tracing** — OpenTelemetry support

### Scaling & High Availability
- [ ] **Horizontal Scaling** — Multiple API instances behind load balancer
- [ ] **Session Affinity** — Sticky sessions for WebSocket connections
- [ ] **Job Queue Scaling** — Multiple worker instances for background jobs
- [ ] **Auto-Scaling** — Kubernetes/Docker Swarm deployment configs

---

## Phase 11 — Standard Plugins

### Core Plugins (implemented — verify feature completeness)
- [ ] **E-commerce Plugin** — Collections: products, carts, orders, invoices, customers, transactions, categories. UI: dashboard, catalog, orders, customers, invoices, transactions, settings. Missing: public storefront checkout flow
- [ ] **LMS Plugin** — Collections: courses, lessons, enrollments, quizzes, certificates, progress, instructors. UI: overview, pages. Missing: student-facing course player, quiz grading UI
- [ ] **Forms Plugin** — Collections: forms, submissions. UI: form-builder, inbox, dashboard, settings. Likely feature-complete — verify notification delivery on submission
- [ ] **Analytics Plugin** — Collections: site-events. UI: dashboard, overview, funnels, insights. Missing: event tracking script injection for frontend, third-party provider bridge (Plausible/Matomo)
- [ ] **MLM Plugin** — Collections: affiliates, programs, commissions, payouts, referrals, tiers, rank-advancements. UI: partner portal block, pages. Missing: payout processing, public referral links
- [ ] **Search Plugin** — Exists at `/plugins/search/`. Native DB full-text search with analytics, weighting, redirects UI. Missing: Elasticsearch/Algolia adapter, frontend search widget
- [ ] **Social Proof Plugin** — Exists at `/plugins/social-proof/`. Collections: reviews, testimonials, activity-notifications. UI: pages. Missing: public-facing comment/like/share components
- [ ] **Privacy Plugin** — Exists at `/plugins/privacy/`. Collections: consent-logs. UI: dashboard, banner, policy-editor, logs. Missing: data export (right of access), data deletion (right to erasure)
- [ ] **Licensing Plugin** — Exists at `/plugins/licensing/`. Collections: license-keys, license-products, activations, verification-logs. Verify completeness of activation flow
- [ ] **Finance Plugin** — Collections: currencies, gift-cards, payment-methods, transactions, wallets. UI: overview, transactions, wallets, gift-cards, settings. Likely complete — verify payment gateway wiring

### Core Plugins (not started)
- [ ] **Auth Plugin** — Advanced auth as a standalone plugin: OAuth social login UI, 2FA, magic links (framework has JWT/session auth built in, but no plugin-level OAuth flow or 2FA)

### Integration Plugins (not started)
- [ ] **Payment Gateways** — PayPal, Square, Mollie (Stripe done in Finance plugin)
- [ ] **Email Marketing** — Mailchimp, SendGrid, ConvertKit
- [ ] **CRM Integration** — Salesforce, HubSpot, Pipedrive
- [ ] **Social Media Auto-post** — Twitter/X, Facebook, LinkedIn
- [ ] **Shipping** — FedEx, UPS, DHL calculator and label printing

### Developer Tools Plugins (not started)
- [ ] **API Explorer** — Interactive API documentation and testing UI
- [ ] **Database Explorer** — Visual DB browser and query tool
- [ ] **Log Viewer** — Real-time log viewing and searching
- [ ] **Performance Profiler** — Request profiling and optimization suggestions
- [ ] **Code Generator** — Visual builder for collections and APIs

---

## Phase 12 — Advanced Features

### Media & Assets
- [ ] **Media Optimization** — Resize done (`sharp`, 2000×2000 max in `packages/media/src/drivers/local-driver.ts`). WebP conversion not done. S3 driver has no optimization at all.
- [ ] **Asset CDN** — Automatic asset upload to CDN on publish

### Headless / SDK
- [ ] **Mobile SDKs** — Official iOS and Android SDKs
- [ ] **JavaScript SDK** — Browser and Node.js client library
- [ ] **Static Site Export** — Export entire site to static HTML

### Performance
- [ ] **Query Optimization** — Automatic N+1 query detection and prevention
- [ ] **Lazy Loading** — On-demand loading of plugins and features
- [ ] **Code Splitting** — Automatic bundle splitting for optimal loading
- [ ] **Service Worker** — Offline support and caching strategies
- [ ] **Database Indexing** — Automatic index suggestions and creation

### Developer Experience
- [x] **TypeScript Strictness** — `"strict": true` already enabled in root `tsconfig.json`
- [ ] **Storybook Integration** — Component library documentation
- [ ] **E2E Testing** — Playwright is set up (Phase 3.8) but test suite coverage is minimal; needs expansion

### Enterprise
- [ ] **SSO Integration** — OAuth2 SSO with Google/Microsoft is done (`GET /auth/sso/providers`, `POST /auth/sso/login`). SAML, LDAP, Active Directory not implemented.
- [ ] **Advanced Permissions** — Standard RBAC exists; custom role creation UI and granular per-collection permission overrides not done
- [ ] **Compliance Tools** — Privacy plugin handles consent logging/banner; data export (right of access) and deletion (right to erasure) not implemented
- [ ] **White Labeling** — Remove Fromcode branding for agencies
