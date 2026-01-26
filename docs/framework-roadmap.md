# Framework Development Roadmap

This document tracks the progress of the `@fromcode` framework development based on the [framework-plan.md](framework-plan.md).

## Phase 1: Foundation (Current Status: COMPLETED ✓)
- [x] **Monorepo Structure**: Set up the base monorepo with API, Core, Auth, React, and SDK packages.
- [x] **Networking & Proxy**: Implemented Nginx Proxy Manager (NPM) and Docker Compose for local domain routing.
- [x] **Core Hook System**: Implemented `HookManager` for event-driven architecture (emit/on).
- [x] **Database Integration**: Moved from mock DB to real PostgreSQL connection with transaction support.
- [x] **Logging System**: Implemented a namespaced, multi-level logger for observability.
- [x] **Authentication Service**: Created `@fromcode/auth` with JWT and Bcrypt support.
- [x] **Frontend Integration**: Established `PluginsContext` to share plugin state and components between layers.
- [x] **Initial Plugin System**: Successful integration of `test-feature` plugin with DB, Auth, and Frontend components.

## Phase 2: Core Modules & Services (Current Status: COMPLETED ✓)
- [x] **Plugin Lifecycle**: `onEnable`, `onDisable` logic (Initial version).
- [x] **ORM Transition**: Move from raw SQL to Drizzle ORM in `DatabaseManager` for type safety and migrations.
- [x] **Media Manager**: Service for handling file uploads, optimization, and storage (Local/S3/R2).
- [x] **Email Service**: Abstracted email provider support (SMTP, SendGrid, SES).
- [x] **Cache Layer**: Redis-ready abstracted caching layer for high-performance access.
- [ ] **Background Jobs**: Queue system (BullMQ/Redis) for long-running tasks and scheduled jobs.
- [x] **Internationalization (i18n)**: Framework-level support for localized content (Shared i18n structure).
- [ ] **Database Configuration**: Multi-database support (PostgreSQL, MySQL, SQLite) with connection pooling.
- [ ] **Storage Configuration**: Flexible storage backend (Local, S3, R2, GCS) with unified API.

## Phase 2.5: API Layer Architecture (Current Status: COMPLETED ✓)
- [x] **REST API Core**: Full REST API implementation with CRUD operations for all resources.
- [ ] **GraphQL API**: Optional GraphQL support with automatic schema generation from collections.
- [ ] **WebSocket API**: Real-time communication layer for live updates and subscriptions.
- [ ] **API Versioning**: URL-based and header-based versioning strategies (`/api/v1`, `/api/v2`).
- [ ] **API Rate Limiting**: Global and per-user rate limits with Redis-backed tracking.
- [ ] **API Authentication**: Multiple auth methods (JWT, Session, API Key, OAuth 2.0).
- [x] **API Documentation**: Auto-generated OpenAPI/Swagger docs from route definitions.
- [x] **API Middleware**: Request validation, sanitization, error handling, and logging.
- [x] **API Filtering & Search**: Support for advanced queries in generic REST controllers.

## Phase 3: Admin UI & Developer Experience (Current Status: COMPLETED ✓)
- [x] **Admin Dashboard Shell**: Core React-based administration interface with modern UI (Tailwind CSS).
- [x] **Security Guard**: Login wall and session persistence using JWT and Next.js Middleware.
- [x] **Mobile-First UX**: Responsive navigation and interactive mobile UI components.
- [x] **System Onboarding**: First-run setup flow for creating administrative accounts.
- [x] **Plugin Management UI**: Interface to browse, install, and toggle plugins (Persistence implemented).
- [x] **High-fidelity Plugin Views**: Detailed management pages for specific plugins with Slot support.
- [x] **Dynamic Collection Sidebar**: Automated sidebar integration for registered collections.
- [x] **Dynamic Collection Lists**: Automated list views for any registered resource.
- [x] **Auto-sync Migrations**: Automatic DB table creation/updates for registered collections.
- [x] **UI Slot System**: Refinement of the slot-based architecture for UI extensibility.
- [x] **Admin Settings UI**: System configuration interface (site settings, email, storage, etc.).
- [x] **User Management UI**: User CRUD, role assignment, permission management.
- [x] **Media Library UI**: File browser, uploader, and media management interface.
- [x] **Form Components**: Standardized UI components (Button, Input, Switch, Dropdown) for admin interactions.
- [x] **Dynamic Forms**: Auto-generated Create/Edit forms based on collection fields.
- [x] **Dashboard Widgets**: Collection stats and dynamic slot-based widgets.
- [ ] **Data Tables**: Advanced table components with sorting, filtering, pagination, and export.
- [ ] **Rich Text Editor**: WYSIWYG editor integration for content management.
- [ ] **Documentation Site**: Guides for installation, plugin development, and API reference.

## Phase 3.5: CLI & Developer Tools (Current Status: COMPLETED ✓)
### Core CLI Commands
- [x] **Project Creation**: `fromcode create <name> --template=<minimal>`
- [x] **Development Server**: `fromcode dev` (Orchestrates Docker and npm dev)
- [x] **Build Commands**: `fromcode build --mode=<full|api|admin|frontend>`
- [ ] **Production Server**: `fromcode start` (Planned)

### Plugin Development
- [x] **Plugin Generator**: `fromcode plugin create <name>` (Capability-aware)
- [ ] **Plugin Dev Mode**: `fromcode plugin dev <name>` (Planned)
- [ ] **Plugin Build**: `fromcode plugin build <name>` (Planned)
- [ ] **Plugin Testing**: `fromcode plugin test <name>` (Planned)
- [x] **Plugin Pack**: `fromcode plugin pack <slug>` (Marketplace-ready ZIP)
- [x] **Plugin List/Search/Install**: Complete marketplace integration via CLI.

### Database Management
- [ ] **Migration Commands**: `fromcode db:migrate`, `fromcode db:rollback`
- [ ] **Seeding**: `fromcode db:seed` with customizable seed files
- [ ] **Backup/Restore**: `fromcode db:backup`, `fromcode db:restore <file>`
- [ ] **Database Reset**: `fromcode db:reset` for development

### Code Generation
- [ ] **Collection Generator**: `fromcode generate collection <name> --fields=...`
- [ ] **API Endpoint Generator**: `fromcode generate api <route>`
- [ ] **Migration Generator**: `fromcode generate migration <name>`
- [ ] **Component Generator**: `fromcode generate component <name>`

### Testing & Quality
- [ ] **Test Runner**: `fromcode test` (unit, integration, e2e)
- [ ] **Linting**: `fromcode lint` with ESLint
- [ ] **Type Checking**: `fromcode typecheck` with TypeScript
- [ ] **System Health**: `fromcode doctor` for diagnostics

### Theme Development
- [ ] **Theme Generator**: `fromcode theme create <name>`
- [ ] **Theme Dev Mode**: `fromcode theme dev <name>` with preview
- [ ] **Theme Build**: `fromcode theme build <name>`
- [ ] **Theme Publish**: `fromcode theme publish <name>`

## Phase 4: Frontend Plugin Architecture (Current Status: IN PROGRESS 🔄)
### Server-Side Integration
- [x] **SSR Plugin Injection**: Automatic plugin integration into Next.js rendering pipeline (Via script loading).
- [x] **Plugin Metadata Injection**: `<head>` modifications (meta tags, scripts, styles) via API and client-side hydration.
- [x] **Plugin Route Registration**: Dynamic route creation from plugins (API serving frontend files).
- [ ] **Middleware Chain**: Plugin-provided middleware execution order

### Component Slot System
- [x] **Core Slot Registry**: Predefined extension points throughout the app.
- [x] **Slot Renderer Component**: `<Slot name="..." />` for plugin injection points.
- [x] **Standard Slots**: Sidebar top/bottom, Header right, Collection List/Edit dynamic slots.
- [x] **Slot Props Passing**: Data flow from app to plugin components.
- [x] **Slot Fallbacks**: Default content when no plugins register.

### Client-Side Plugin Loading
- [ ] **Build-Time Loading**: Compile plugins into main bundle (production).
- [x] **Runtime Loading**: Dynamic plugin loading via API (development/flexible mode).
- [ ] **Hybrid Strategy**: Core plugins build-time, optional plugins runtime.
- [x] **Plugin Context Provider**: React context for plugin state and APIs (Exposed via window bridge).
- [x] **Plugin Hooks**: `usePlugins()`, `window.Fromcode` bridge for runtime components.

### Plugin Frontend Build System
- [x] **Plugin Frontend Structure**: Standardized `frontend/` directory in plugins
- [ ] **Independent Plugin Builds**: Each plugin builds its own frontend bundle
- [x] **Asset Serving**: Automatic serving of plugin assets at `/plugins/<slug>/frontend/*`
- [ ] **CSS Isolation**: Scoped styles or CSS modules per plugin
- [ ] **Hot Module Replacement**: HMR support for plugin development

### Plugin Communication
- [x] **Frontend Event Bus**: Client-side pub/sub for inter-plugin communication (emit/on).
- [x] **Plugin API Exposure**: Plugins expose public APIs for other plugins via `registerAPI`.
- [ ] **Shared State Management**: Optional shared state between plugins
- [ ] **Plugin Dependencies**: Frontend plugin dependency resolution

## Phase 5: Security & Plugin Isolation (Current Status: PLANNED)
### Plugin Sandboxing
- [ ] **Process Isolation**: Worker threads or V8 isolates for plugin execution
- [ ] **Resource Quotas**: Memory, CPU, network limits per plugin
- [ ] **Capability System**: Declare and enforce plugin capabilities
- [ ] **Permission Checking**: Runtime permission validation for all operations
- [ ] **Secure Context Injection**: Scoped API access based on capabilities

### Inter-Plugin Security
- [ ] **API-Only Communication**: Enforce secure plugin-to-plugin calls
- [ ] **Data Isolation**: Plugins cannot access other plugins' data directly
- [ ] **Event Filtering**: Plugins only receive events they're subscribed to
- [ ] **Namespace Isolation**: Prevent naming collisions and conflicts

### Code Signing & Verification
- [ ] **Plugin Signature System**: RSA signing of plugin packages
- [ ] **Signature Verification**: Verify signatures on installation
- [ ] **Checksum Validation**: SHA-256 checksums for plugin integrity
- [ ] **Trusted Publishers**: Verified developer accounts
- [ ] **Security Badges**: Visual indicators for verified plugins

### Runtime Security Monitoring
- [ ] **Activity Tracking**: Log all plugin operations (DB, API, files)
- [ ] **Anomaly Detection**: Flag suspicious plugin behavior
- [ ] **Security Dashboard**: Real-time security monitoring UI
- [ ] **Audit Logs**: Immutable audit trail for compliance
- [ ] **Emergency Shutdown**: Ability to instantly disable problematic plugins

### API Security
- [ ] **JWT Authentication**: Secure token-based auth with refresh tokens
- [ ] **Session Management**: Secure session storage and expiration
- [ ] **CSRF Protection**: Token-based CSRF prevention
- [ ] **XSS Prevention**: Input sanitization and output encoding
- [ ] **SQL Injection Protection**: Parameterized queries and ORM safety

## Phase 6: Marketplace & Plugin Ecosystem (Current Status: PLANNED)
### Marketplace Registry
- [ ] **Plugin Registry Backend**: Central repository for plugin metadata and packages
- [ ] **Plugin Discovery API**: Search, filter, and browse plugins
- [ ] **Version Management**: Support for multiple plugin versions
- [ ] **Dependency Resolution**: Automatic dependency installation
- [ ] **Download Stats**: Track installations and active users

### Marketplace Client
- [ ] **Admin UI Integration**: Browse and install plugins from admin panel
- [ ] **One-Click Install**: Automatic download, verification, and installation
- [ ] **Plugin Updates**: Notification and update mechanism
- [ ] **Review System**: User ratings and reviews for plugins
- [ ] **Plugin Screenshots**: Gallery view of plugin features

### Developer Portal
- [ ] **Developer Accounts**: Registration and authentication for publishers
- [ ] **Plugin Submission**: Upload and publish plugins to marketplace
- [ ] **Analytics Dashboard**: Download stats, revenue, and user feedback
- [ ] **Documentation Tools**: Automatic docs generation from code
- [ ] **Revenue Sharing**: Payment system for paid plugins (Stripe integration)

### Plugin Categories & Curation
- [ ] **Category System**: Organize plugins (CMS, E-commerce, SEO, etc.)
- [ ] **Featured Plugins**: Editorial selection of high-quality plugins
- [ ] **Official Plugins**: Fromcode-maintained core plugins
- [ ] **Community Plugins**: Third-party contributed plugins
- [ ] **Quality Badges**: Verified, popular, trending indicators

## Phase 7: Theme System (Current Status: PLANNED)
### Theme Structure & Manifest
- [ ] **Theme Plugin Type**: Special plugin category for presentation
- [ ] **Theme Manifest**: Extended plugin.json with theme-specific fields
- [ ] **Multi-Framework Support**: React, Vue, Svelte theme compatibility
- [ ] **Theme Assets**: Fonts, images, icons bundling

### Component Override System
- [ ] **Core Component Overrides**: Replace any core framework component
- [ ] **Plugin Component Overrides**: Replace components from other plugins
- [ ] **Override Registry**: Central registry of overridable components
- [ ] **Fallback Mechanism**: Graceful degradation if override fails
- [ ] **Override Priority**: Handle multiple themes/plugins overriding same component

### Theme Configuration
- [ ] **Theme Settings Collection**: Database-backed theme customization
- [ ] **Color Schemes**: Light/dark mode and custom color palettes
- [ ] **Typography Settings**: Font family, sizes, line heights
- [ ] **Layout Options**: Sidebar position, header style, footer layout
- [ ] **Widget Areas**: Configurable widget zones

### Theme Development Tools
- [ ] **Theme Generator**: `fromcode theme create <name>` CLI command
- [ ] **Theme Dev Mode**: Live preview with hot reload
- [ ] **Theme Builder UI**: Visual theme customization interface
- [ ] **Theme Export**: Package themes for distribution
- [ ] **Theme Marketplace**: Dedicated section for theme discovery

### Standard Themes
- [ ] **Default Theme**: Clean, minimal theme (included in core)
- [ ] **Blog Theme**: Content-focused theme for blogs and magazines
- [ ] **E-commerce Theme**: Product showcase and shop layout
- [ ] **Portfolio Theme**: Creative portfolio and gallery layout
- [ ] **Business Theme**: Corporate and professional design

## Phase 8: Multi-Tenancy & Multi-Store (Current Status: PLANNED)
### Tenant Isolation
- [ ] **Database Isolation Strategies**: Schema-per-tenant, DB-per-tenant, row-level security
- [ ] **Tenant Context**: Automatic tenant detection and context injection
- [ ] **Tenant Configuration**: Per-tenant settings and feature flags
- [ ] **Tenant Middleware**: Request routing based on domain/subdomain
- [ ] **Tenant Migration**: Tools for moving tenants between databases

### Multi-Store Architecture
- [ ] **Store Entity**: Multiple stores per tenant with independent settings
- [ ] **Store Detection**: Domain-based or path-based store routing
- [ ] **Shared Resources**: Products, users, orders across stores
- [ ] **Store-Specific Content**: Localized content per store
- [ ] **Cross-Store Analytics**: Unified reporting across all stores

### Tenant Management
- [ ] **Tenant Admin UI**: Create, configure, and manage tenants
- [ ] **Tenant Provisioning**: Automated tenant setup and onboarding
- [ ] **Tenant Billing**: Usage tracking and billing per tenant
- [ ] **Tenant Limits**: Resource quotas and feature restrictions
- [ ] **Tenant Backup/Restore**: Isolated backup for each tenant

### Tenant-Aware Plugins
- [ ] **Automatic Tenant Context**: All plugins receive tenant context
- [ ] **Tenant-Scoped Data**: Database queries filtered by tenant ID
- [ ] **Tenant-Specific Config**: Per-tenant plugin configuration
- [ ] **Cross-Tenant Features**: Optional data sharing between tenants

## Phase 9: Deployment & DevOps (Current Status: PLANNED)
### Docker Deployment Modes
- [ ] **API-Only Mode**: Headless CMS deployment for mobile/external apps
- [ ] **API + Admin Mode**: Backend services without public frontend
- [ ] **Full-Stack Mode**: Complete deployment (API + Admin + Frontend)
- [ ] **Frontend-Only Mode**: Edge deployment with external API
- [ ] **Docker Compose Templates**: Development and production configurations

### Infrastructure Configuration
- [ ] **Environment Validation**: Type-safe environment variable loading (Zod)
- [ ] **Configuration Presets**: Development, staging, production configs
- [ ] **Service Orchestration**: Automatic service startup based on mode
- [ ] **Health Checks**: Endpoint monitoring and automatic restarts
- [ ] **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT

### Database Management
- [ ] **Connection Pooling**: Efficient database connection management
- [ ] **Read Replicas**: Support for read-only database replicas
- [ ] **Database Migrations**: Safe schema updates in production
- [ ] **Database Backups**: Automated backup scheduling and retention
- [ ] **Point-in-Time Recovery**: Restore to specific timestamps

### Caching & Performance
- [ ] **Redis Integration**: Distributed caching with Redis
- [ ] **CDN Integration**: Asset serving via CDN (Cloudflare, AWS CloudFront)
- [ ] **Edge Caching**: Deploy frontend to edge locations (Vercel, Cloudflare)
- [ ] **Query Caching**: Automatic API response caching
- [ ] **Static Site Generation**: Pre-render pages at build time

### Monitoring & Observability
- [ ] **Logging Integration**: Structured logging to file, console, or service
- [ ] **Error Tracking**: Sentry integration for error monitoring
- [ ] **Performance Monitoring**: APM integration (Datadog, New Relic)
- [ ] **Metrics Collection**: Prometheus-compatible metrics endpoint
- [ ] **Distributed Tracing**: OpenTelemetry support

### Scaling & High Availability
- [ ] **Horizontal Scaling**: Multiple API instances behind load balancer
- [ ] **Session Affinity**: Sticky sessions for WebSocket connections
- [ ] **Job Queue Scaling**: Multiple worker instances for background jobs
- [ ] **Database Scaling**: Connection pooling and query optimization
- [ ] **Auto-Scaling**: Kubernetes/Docker Swarm deployment configs

## Phase 10: Standard Plugins & Ecosystem (Current Status: PLANNED)
### Core Plugins (Official)
- [ ] **CMS Plugin**: Full content management system (posts, pages, media)
- [ ] **E-commerce Plugin**: Complete shop solution (products, cart, checkout, orders)
- [ ] **LMS Plugin**: Learning management (courses, lessons, quizzes, certificates)
- [ ] **SEO Plugin**: Meta tags, sitemaps, social sharing, analytics
- [ ] **Forms Plugin**: Form builder with submissions and notifications
- [ ] **Auth Plugin**: Advanced authentication (OAuth, 2FA, magic links)
- [ ] **Social Plugin**: Comments, likes, shares, user profiles
- [ ] **Search Plugin**: Full-text search with Elasticsearch/Algolia
- [ ] **Analytics Plugin**: Privacy-friendly analytics (Plausible, Matomo)
- [ ] **MLM Plugin**: Multi-level marketing (commissions, genealogy, ranks)

### Integration Plugins
- [ ] **Payment Gateways**: Stripe, PayPal, Square, Mollie integrations
- [ ] **Email Marketing**: Mailchimp, SendGrid, ConvertKit integrations
- [ ] **CRM Integration**: Salesforce, HubSpot, Pipedrive connectors
- [ ] **Social Media**: Auto-posting to Twitter, Facebook, LinkedIn
- [ ] **Shipping**: FedEx, UPS, DHL shipping calculator and label printing

### Developer Tools Plugins
- [ ] **API Explorer**: Interactive API documentation and testing
- [ ] **Database Explorer**: Visual database browser and query tool
- [ ] **Log Viewer**: Real-time log viewing and searching
- [ ] **Performance Profiler**: Request profiling and optimization suggestions
- [ ] **Code Generator**: Visual builder for collections and APIs

## Phase 11: Advanced Features & Polish (Current Status: PLANNED)
### Content Management
- [ ] **Version Control**: Content versioning and rollback
- [ ] **Workflow System**: Draft → Review → Publish workflows
- [ ] **Content Scheduling**: Schedule posts for future publication
- [ ] **Media Optimization**: Automatic image resizing and WebP conversion
- [ ] **Asset CDN**: Automatic asset upload to CDN

### Headless & API-First
- [ ] **Mobile SDKs**: Official iOS and Android SDKs
- [ ] **JavaScript SDK**: Browser and Node.js client library
- [ ] **Webhooks**: Event notifications to external systems
- [ ] **API Webhooks UI**: Webhook configuration in admin panel
- [ ] **Static Site Export**: Export to static HTML for hosting

### Performance Optimization
- [ ] **Query Optimization**: Automatic N+1 query detection and prevention
- [ ] **Lazy Loading**: On-demand loading of plugins and features
- [ ] **Code Splitting**: Automatic bundle splitting for optimal loading
- [ ] **Service Worker**: Offline support and caching strategies
- [ ] **Database Indexing**: Automatic index suggestions and creation

### Developer Experience
- [ ] **TypeScript Strictness**: Full type safety across entire codebase
- [ ] **API Playground**: GraphQL-style API explorer
- [ ] **Seed Data**: Customizable seed data for development
- [ ] **Storybook Integration**: Component library documentation
- [ ] **E2E Testing**: Playwright/Cypress test suite

### Enterprise Features
- [ ] **SSO Integration**: SAML, LDAP, Active Directory support
- [ ] **Advanced Permissions**: Custom roles and granular permissions
- [ ] **Compliance Tools**: GDPR, CCPA data export and deletion
- [ ] **Audit Trail**: Complete activity logging for security
- [ ] **White Labeling**: Remove Fromcode branding for agencies

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Foundation | ✓ Completed | 100% |
| Phase 2: Core Modules | ✓ Completed | 85% (missing Background Jobs & multi-DB) |
| Phase 2.5: API Layer | � In Progress | 25% |
| Phase 3: Admin UI & DX | 🔄 In Progress | 85% |
| Phase 3.5: CLI Tools | 📋 Planned | 0% |
| Phase 4: Frontend Plugin System | 🔄 In Progress | 65% |
| Phase 5: Security & Isolation | 📋 Planned | 0% |
| Phase 6: Marketplace | 📋 Planned | 0% |
| Phase 7: Theme System | 📋 Planned | 0% |
| Phase 8: Multi-Tenancy | 📋 Planned | 0% |
| Phase 9: Deployment & DevOps | 📋 Planned | 0% |
| Phase 10: Standard Plugins | 📋 Planned | 0% |
| Phase 11: Advanced Features | 📋 Planned | 0% |

**Overall Project Completion: ~15%**

---

## Next Priority Actions

Based on the current state and architecture plan, the recommended next steps are:

1. **Complete Phase 3 (Admin UI)**: Finish UI slot system and basic admin features
2. **Start Phase 3.5 (CLI Tools)**: Begin CLI development for better DX
3. **Critical: Phase 4 (Frontend Plugin System)**: This is marked CRITICAL in the plan and is fundamental to the plugin architecture
4. **Phase 2.5 (API Layer)**: Complete the API architecture with REST/GraphQL/WebSocket support
5. **Phase 5 (Security)**: Implement plugin sandboxing and security before opening to third-party plugins

---
*Last Updated: January 23, 2026*
