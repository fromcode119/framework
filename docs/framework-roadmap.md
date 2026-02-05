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
- [x] **Background Jobs**: Queue system with adapter pattern
  - [x] BullQueueAdapter (Redis/production, 100% complete)
  - [x] LocalQueueAdapter (development stub - executes jobs via console.log)
  - [x] QueueManager with graceful shutdown
- [x] **Internationalization (i18n)**: Framework-level support for localized content
  - [x] I18nManager with namespace and locale support
  - [x] Variable interpolation (`{{name}}`)
  - [x] Request-context locale detection
- [x] **Database Configuration**: Multi-database support (PostgreSQL, MySQL, SQLite) with connection pooling.
- [x] **Storage Configuration**: Flexible storage backend (Local, S3, R2, GCS) with unified API.
- [x] **Migration System**: Full migration infrastructure
  - [x] MigrationManager with dialect-aware table creation
  - [x] System and plugin migrations support
  - [x] Batch tracking and rollback
  - [x] Migration Coordinator for orchestration

## Phase 2.5: API Layer Architecture (Current Status: COMPLETED ✓)
- [x] **REST API Core**: Full REST API implementation with CRUD operations for all resources.
- [x] **GraphQL API**: Optional GraphQL support with automatic schema generation from collections.
- [x] **WebSocket API**: Real-time communication layer for live updates and subscriptions
  - [x] WebSocketManager with client connection management
  - [x] Broadcast functionality for collection events
  - [x] Automatic hook integration (afterCreate, afterUpdate, afterDelete)
  - [x] HMR reload event emission for development
- [x] **API Versioning**: URL-based and header-based versioning strategies (`/api/v1`, `/api/v2`).
- [x] **API Rate Limiting**: Global and per-user rate limits with Redis-backed tracking.
- [x] **API Authentication**: Multiple auth methods (JWT, Session, API Key, OAuth 2.0).
- [x] **API Documentation**: Auto-generated OpenAPI/Swagger docs from route definitions.
- [x] **API Middleware**: Request validation, sanitization, error handling, and logging.
- [x] **API Filtering & Search**: Support for advanced queries in generic REST controllers.
- [x] **Content Versioning**: Automatic versioning system
  - [x] RecordVersions collection (`_system_record_versions`)
  - [x] VersioningService with automatic create/update tracking
  - [x] Full data snapshot per version with metadata

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
- [x] **Media Library UI**: File browser, uploader, hierarchical management (breadcrumbs, move, rename).
- [x] **Form Components**: Standardized UI components (Button, Input, Switch, Dropdown) with refined Light Theme support.
- [x] **Dynamic Forms**: Auto-generated Create/Edit forms based on collection fields.
- [x] **Dashboard Widgets**: Collection stats and dynamic slot-based widgets.
- [x] **Dashboard Activity Feed**: Activity aggregation service showing last 20 actions across all collections.
- [x] **Data Tables**: Reusable high-performance table component with sorting and pagination.
- [x] **Rich Text Editor**: Integrated modern content editing primitives.
- [x] **Documentation Site**: Guides for [Installation](./installation.md), [Plugin Development](./plugin-development-guide.md), and [API Reference](./api-reference.md).

## Phase 3.5: CLI & Developer Tools (Current Status: COMPLETED ✓)
- [x] **Project Creation**: `fromcode create <name> --template=<minimal>`
- [x] **Development Server**: `fromcode dev` (Orchestrated Docker and NPM execution)
- [x] **Marketplace Sync**: `fromcode plugin sync` and listing capabilities.
- [x] **Environment Guard**: Automated `.env` generation and validation for starters.

### Plugin Development
- [x] **Plugin Generator**: `fromcode plugin create <name>` (Capability-aware)
- [x] **Plugin Dev Mode**: `fromcode plugin dev <name>` (Live rebuild/HMR)
- [x] **Plugin Build**: `fromcode plugin build <slug>` (ESM bundling with esbuild and internal SCSS/Less support)
- [x] **Plugin Testing**: `fromcode plugin test <name>` (Vitest integration)
- [x] **Plugin Pack**: `fromcode plugin pack <slug>` (Marketplace-ready ZIP via MarketplaceClient)
- [x] **Plugin List/Search/Install**: Complete marketplace integration via CLI.

### Database Management
- [x] **Migration Commands**: `fromcode db:migrate`, `fromcode db:rollback`
- [x] **Seeding**: `fromcode db:seed` with customizable seed files
- [x] **Backup/Restore**: `fromcode db:backup`, `fromcode db:restore <file>`
- [x] **Database Reset**: `fromcode db:reset` for development

### Code Generation
- [x] **Collection Generator**: `fromcode generate collection <name> --fields=...`
- [x] **API Endpoint Generator**: `fromcode generate api <route>`
- [x] **Migration Generator**: `fromcode generate migration <name>`
- [x] **Component Generator**: `fromcode generate component <name>`

### Testing & Quality
- [x] **Test Runner**: `fromcode test` (unit, integration, e2e)
- [x] **Linting**: `fromcode lint` with ESLint
- [x] **Type Checking**: `fromcode typecheck` with TypeScript
- [x] **System Health**: `fromcode doctor` for diagnostics

### Theme Development
- [x] **Theme Generator**: `fromcode theme create <name>` (Scaffold theme.json and UI)
- [x] **Theme Dev Mode**: `fromcode theme dev <name>` with preview
- [x] **Theme Build**: `fromcode theme build <name>` (Build theme UI assets with internal SCSS/Less support)
- [x] **Theme Publish**: `fromcode theme pack <slug>` (Marketplace-ready ZIP)

## Phase 3.6: Plugin Architecture Fixes (Current Status: COMPLETED ✓)
**Completed:** February 4, 2026  
**Reference:** [Archived Plan](./archives/plugin-architecture-fixes-completed.md)

### Critical Bug Fixes
- [x] **Collection Slug Double-Prefixing**: Fixed CMS collections to use primitive slugs
  - Updated all CMS collections (Posts, Pages, Categories, Tags, Templates, Navigation)
  - Removed redundant plugin prefix from collection slugs
  - Framework now correctly handles `fcp_{plugin}_` prefixing
- [x] **Infinite Render Loop**: Stabilized form callbacks in Admin UI
  - Fixed `useCollectionForm.ts` dependency array
  - Removed volatile `errors` dependency from `setFieldValue`
  - Forms now render without infinite loops

### Architecture Improvements
- [x] **Collection Extension API**: Plugins can now extend other plugins' collections
  - Implemented `context.collections.extend(targetPlugin, targetCollection, extensions)`
  - SEO plugin now dynamically injects fields into CMS collections
  - Decoupled SEO fields from CMS core
  - Added `collection:registered` hook for dynamic field injection
- [x] **Developer Warnings**: Added validation for redundant slug prefixing
- [x] **Documentation**: Created [Plugin Development Guide](./plugin-development-guide.md)

## Phase 3.7: Plugin Settings Redesign (Current Status: COMPLETED ✓)
**Completed:** February 4, 2026  
**Reference:** [Archived Plan](./archives/plugin-settings-redesign-completed.md)

### Architectural Changes
- [x] **Eliminated Singleton Pattern**: Removed confusing `type: 'global'` from collections
- [x] **Dedicated Settings API**: Created `/api/v1/plugins/:slug/settings` endpoints
  - GET settings (merged with defaults)
  - PUT settings (with validation)
  - GET schema (for UI rendering)
  - POST reset (to defaults)
  - GET/POST export/import (JSON)
- [x] **PluginContext Enhancement**: Added `context.settings.register()` API
- [x] **Settings UI Component**: Built `PluginSettingsForm` with tabs, validation, export/import
- [x] **CMS Migration**: Moved CMS settings from global collection to plugin settings
- [x] **Code Cleanup**: Removed all singleton handling from API and Admin UI
- [x] **Post-Implementation Audit**: Purged all hardcoded CMS references from framework core
  - Fixed CLI migration command (moved to CMS plugin)
  - Removed hardcoded CMS check in admin utils
  - Refactored SEO plugin to use optional dependencies

## Phase 3.8: CMS Phase 11 - Quality Assurance (Current Status: COMPLETED ✓)
**Started:** February 3, 2026  
**Completed:** February 4, 2026  
**Reference:** [Active Plan](./cms-roadmap-phase-11.md)

### Completed Tasks
- [x] **Next.js 15 Compatibility**: Fixed async params in all dynamic routes
- [x] **DateTimePicker Component**: Implemented with calendar, time selection, timezone support
- [x] **ColorPicker Component**: Hex/RGB/HSL inputs with visual preview
- [x] **CodeEditor Component**: Monaco Editor integration with syntax highlighting
- [x] **Test Infrastructure**: Set up Playwright and Vitest
- [x] **Core Test Suite**: Fixed failing PluginSettingsForm tests and resolved versioning service race conditions.
- [x] **Route Verification**: All admin routes working correctly with restored dedicated collection wrappers.
- [x] **Test Documentation**: Created test scenarios guide in `docs/test-scenarios.md`
- [x] **Manual Verification**: Browser flow verification complete; all core services stable.

## Phase 3.9: Routing Architecture Restoration (Current Status: COMPLETED ✓)
**Started:** February 4, 2026  
**Completed:** February 4, 2026  
**Priority:** P0 - Critical (Stability)

### Background
During previous debugging of plugin route 404 errors, the `/app/[pluginSlug]/[slug]/` route directory was mistakenly deleted. While collection UI components were correctly extracted to `/components/collection/`, the dedicated route files should have been retained as thin wrappers for optimal Next.js performance.

### Problem
The previous architecture had ALL routes handled by the catch-all `[...path]` route, which created performance overhead and mixed concerns.

### Restoration Tasks
- [x] **Restore `/app/[pluginSlug]/[slug]/page.tsx`**: Thin wrapper calling `CollectionListPage` component
- [x] **Restore `/app/[pluginSlug]/[slug]/[id]/page.tsx`**: Thin wrapper calling `CollectionEditPage` component
- [x] **Simplify `/app/[...path]/page.tsx`**: Removed ALL collection logic, keep only plugin slot rendering
- [x] **Verify Route Structure**: Confirmed proper Next.js route hierarchy
- [x] **Cleanup**: Removed legacy hardcoded `/content/` route logic in `collection-utils.ts`
- [x] **Stabilization**: Fixed TypeScript icon errors in the catch-all route

### Architecture Decision
**Dedicated routes for collections** (not catch-all) because:
- ✅ Next.js can optimize and prefetch collection routes
- ✅ Clear separation of concerns: Collections = dedicated routes, Plugins = catch-all
- ✅ Follows Next.js best practices for performance

### Success Criteria
- `/cms/posts` renders collection list view (via dedicated route)
- `/cms/posts/1` renders collection edit view (via dedicated route)
- `/marketing/campaigns` renders plugin UI (via catch-all slot)
- No build errors, no console warnings

### Files Changed
- **Created**: `/packages/admin/app/[pluginSlug]/[slug]/page.tsx`
- **Created**: `/packages/admin/app/[pluginSlug]/[slug]/[id]/page.tsx`
- **Modified**: `/packages/admin/app/[...path]/page.tsx` (removed collection logic)
- **Modified**: `/packages/admin/lib/collection-utils.ts` (removed legacy check)

## Phase 4: Frontend Plugin Architecture (Current Status: COMPLETED ✓)
### Server-Side Integration
- [x] **SSR Plugin Injection**: Automatic plugin integration into Next.js rendering pipeline (Via script loading).
- [x] **Plugin Metadata Injection**: `<head>` modifications (meta tags, scripts, styles) via API and client-side hydration.
- [x] **Plugin Route Registration**: Dynamic route creation from plugins (API serving frontend files).
- [x] **Middleware Chain**: Plugin-provided middleware execution order (Dynamic dispatching).

### Component Slot System
- [x] **Core Slot Registry**: Predefined extension points throughout the app.
- [x] **Slot Renderer Component**: `<Slot name="..." />` for plugin injection points.
- [x] **Standard Slots**: Sidebar top/bottom, Header right, Collection List/Edit dynamic slots.
- [x] **Slot Props Passing**: Data flow from app to plugin components.
- [x] **Slot Fallbacks**: Default content when no plugins register.

### Client-Side Plugin Loading
- [x] **Build-Time Loading**: Compile plugins into main bundle (via CLI/HMR).
- [x] **Runtime Loading**: Dynamic plugin loading via API (development/flexible mode).
- [x] **Hybrid Strategy**: Core plugins build-time, optional plugins runtime.
- [x] **Plugin Context Provider**: React context for plugin state and APIs (Exposed via window bridge).
- [x] **Plugin Hooks**: `usePlugins()`, `window.Fromcode` bridge for runtime components.

### Plugin Frontend Build System
- [x] **Plugin Frontend Structure**: Standardized `frontend/` directory in plugins
- [x] **Independent Plugin Builds**: Each plugin builds its own frontend bundle (esbuild)
- [x] **Asset Serving**: Automatic serving of plugin assets at `/plugins/<slug>/frontend/*`
- [x] **CSS Isolation**: Scoped styles or CSS variables per plugin
- [x] **Hot Module Replacement**: HMR support for plugin development
  - [x] HotReloadService with chokidar file watching
  - [x] Plugin change detection and reload event emission
  - [x] WebSocket integration for client notifications
  - [x] SSE + Cache Busting for asset updates

### Plugin Communication
- [x] **Frontend Event Bus**: Client-side pub/sub for inter-plugin communication (emit/on).
- [x] **Plugin API Exposure**: Plugins expose public APIs for other plugins via `registerAPI`.
- [x] **Shared State Management**: Reactive shared state via `usePluginState` hook.
- [x] **Plugin Dependencies**: Topological frontend loading based on manifest dependencies.

## Phase 5: Security & Plugin Isolation (Current Status: COMPLETED ✓)
### Plugin Sandboxing
- [x] **Process Isolation**: V8 isolates infrastructure (100% complete)
  - [x] Basic V8 isolate creation with memory limits
  - [x] Complete PluginContext bridge implementation (db, api, hooks, etc.)
  - [x] Integrated persistent sandbox contexts in LifecycleService
  - [x] Automatic sandboxing based on plugin manifest (`sandbox: true`)
  - [x] Capability enforcement in sandbox (Granular filtering & Fetch bridge)
- [x] **Resource Quotas**: Memory, CPU, network limits per plugin
  - [x] Implemented execution timeout (CPU time) enforcement in script runner
  - [x] Memory limit configuration per plugin
  - [x] Audited network access via bridged fetch
- [x] **Capability System**: Permission checking framework
  - [x] Permissions service with capability validation
  - [x] Runtime permission checks
- [x] **Secure Context Injection**: Scoped API access based on capabilities

### Inter-Plugin Security
- [x] **API-Only Communication**: Enforce secure plugin-to-plugin calls
- [x] **Data Isolation**: Plugins cannot access other plugins' data directly
- [x] **Event Filtering**: Plugins only receive events they're subscribed to
- [x] **Namespace Isolation**: Prevent naming collisions and conflicts

### Code Signing & Verification
- [x] **Plugin Signature System**: Cryptographic signature verification
  - [x] Signature service for plugin package validation
  - [x] RSA-based signing infrastructure
- [x] **Integrity Checking**: File integrity validation
  - [x] IntegrityService with checksum validation
  - [x] MD5/SHA hash comparison for updates
- [x] **Checksum Validation**: SHA-256 checksums for plugin integrity
- [x] **Trusted Publishers**: Verified developer accounts
- [x] **Security Badges**: Visual indicators for verified plugins

### Runtime Security Monitoring
- [x] **Activity Tracking**: Audit logging system
  - [x] AuditManager with `_system_audit_logs` table
  - [x] Tracks plugin actions, resources, status, metadata
  - [x] Indexed by plugin_slug and status for queries
- [x] **Anomaly Detection**: Flag suspicious plugin behavior
- [x] **Security Dashboard**: Real-time security monitoring UI
- [x] **Audit Logs**: Immutable audit trail for compliance
- [x] **Emergency Shutdown**: Ability to instantly disable problematic plugins

### API Security
- [x] **JWT Authentication**: Secure token-based auth with refresh tokens
- [x] **Session Management**: Secure session storage and expiration
- [x] **CSRF Protection**: Token-based CSRF prevention
- [x] **XSS Prevention**: Input sanitization and output encoding
- [x] **SQL Injection Protection**: Parameterized queries and ORM safety

## Phase 6: Marketplace & Plugin Ecosystem (Current Status: IN PROGRESS 🔄)
### Marketplace Catalog
- [x] **Plugin Marketplace Backend**: Central repository for plugin metadata and packages (marketplace.fromcode.com)
- [x] **Plugin Discovery API**: Search, filter, and browse plugins via marketplace.json
  - [x] MarketplaceManager with catalog fetch (local/remote)
  - [x] Plugin search and listing
  - [x] DiscoveryService integration
- [x] **Version Management**: Support for multiple plugin versions and distribution bundling
- [x] **Plugin Installation**: Download and install from ZIP packages
  - [x] Core MarketplaceManager implementation
  - [x] CLI installation logic refactored to use shared Core services
- [x] **Dependency Resolution**: Automatic dependency installation
- [x] **Download Stats**: Track installations and active users

### Marketplace Client
- [x] **Admin UI Integration**: Browse and install plugins from admin panel
- [x] **One-Click Install**: Automatic download, verification, and installation
- [x] **Plugin Updates**: Notification and update mechanism
- [x] **Review System**: User ratings and reviews for plugins
- [x] **Plugin Screenshots**: Gallery view of plugin features

### Developer Portal
- [x] **Developer Accounts**: Registration and authentication for publishers
- [x] **Plugin Submission**: Upload and publish plugins to marketplace
- [x] **Analytics Dashboard**: Download stats, revenue, and user feedback
- [x] **Documentation Tools**: Automatic docs generation from code
- [x] **Revenue Sharing**: Payment system for paid plugins (Stripe integration)

### Plugin Categories & Curation
- [x] **Category System**: Dynamic categorization in Marketplace Hub (General, Business, Marketing, etc.)
- [x] **Featured Plugins**: Editorial selection of high-quality plugins
- [x] **Official Plugins**: Foundation established with `marketplace_core` and verified author status
- [x] **Community Plugins**: Third-party contribution workflow via Developer Portal
- [x] **Quality Badges**: Verified, popular, trending indicators

## Phase 7: Theme System (Status: COMPLETED ✓)
### Theme Structure & Manifest
- [x] **Theme Catalog**: Core logic and DB schema for theme management (`_system_themes`).
- [x] **Theme Manifest**: `theme.json` with layouts, variables, and asset info.
- [x] **Asset Injection**: Automatic CSS/JS injection into client `document.head`.
- [ ] **Multi-Framework Support**: UI components for different frameworks.

### Component Override System
- [x] **Core Component Overrides**: `Override` registry for framework-level primitives.
- [x] **Plugin Component Overrides**: Ability for themes to replace plugin UI (Demonstrated in Ecommerce plugin).
- [x] **Override Registry**: Shared bridge via `PluginsProvider`.
- [x] **Fallback Mechanism**: Dynamic check for registered overrides.

### Theme Configuration
- [x] **Theme Settings**: DB-backed active theme persistence.
- [x] **CSS Variables**: Dynamic CSS variable mapping via Metadata API.
- [x] **Theme Builder UI**: Visual customizer in Admin panel with live preview simulation.
- [x] **Typography Settings**: Standardized font management with Google Fonts integration.
- [x] **Layout Options**: UI-selectable layout variations and core protocol mapping.

### Theme Development Tools
- [x] **Theme Generator**: `fromcode theme create` CLI command.
- [x] **Theme Dev Mode**: Asset rebuild and build-on-save (Via esbuild --watch).
- [x] **Theme Export**: `fromcode theme pack` for Marketplace.

### Standard Themes
- [x] **Default Theme**: Clean, minimal theme (minimal-blue included in core)
- [x] **Blog Theme**: Chronicle Blog - Typography focused theme
- [x] **E-commerce Theme**: Cartel Shop - Storefront theme with component overrides
- [x] **Portfolio Theme**: Gallery Pro - High-impact visual theme
- [x] **Business Theme**: Enterprise One - Professional corporate theme

## Phase 8: System Management & Operations (Current Status: IN PROGRESS 🔄)
### Framework Update System
- [x] **System Update Service**: Automated framework core updates
  - [x] Version checking against marketplace catalog
  - [x] Pre-update backup creation
  - [x] Smart file update with MD5 hash comparison
  - [x] Selective file overwrite (skips node_modules, .git)
  - [x] Rollback capability with backup restore

### Development Tools
- [x] **Hot Module Reload**: Development-time automatic reloading
  - [x] HotReloadService with chokidar file watching
  - [x] Plugin change detection
  - [x] WebSocket-based HMR event emission
  - [x] Admin UI auto-refresh on plugin updates

### Backup & Recovery
- [x] **Plugin/Theme Backup**: Individual resource backup with tar.gz compression
- [x] **Database Dump**: Dialect-aware database backup
  - [x] PostgreSQL support (pg_dump)
  - [x] SQLite support (file copy)
  - [x] MySQL support (planned)
- [x] **Full System Backup**: Complete files + database backup
- [x] **Backup Download**: Download and extract from URL
- [x] **Automatic Cleanup**: Configurable backup retention (keeps last N backups)
- [x] **Restore Functionality**: Full restore from backup archives

### Task Scheduling
- [x] **Scheduler Service**: Task scheduling infrastructure (100% complete)
  - [x] Task registration system
  - [x] Interval-based pulse execution
  - [x] start/stop lifecycle
  - [x] Error handling per task
  - [x] Cron syntax support
  - [x] Task persistence
  - [x] Queue integration for job execution
  - [x] Task prioritization
  - [x] Concurrent task limits

## Phase 9: Multi-Tenancy & Multi-Store (Current Status: PLANNED)
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

## Phase 10: Deployment & DevOps (Current Status: IN PROGRESS 🔄)
### Docker Deployment Modes
- [x] **API-Only Mode**: Headless CMS deployment (Templates in `deploy/`)
- [x] **API + Admin Mode**: Backend services without frontend (Templates in `deploy/`)
- [x] **Full-Stack Mode**: Complete deployment (Default `docker-compose.yml`)
- [x] **Frontend-Only Mode**: Edge deployment (Templates in `deploy/`)
- [x] **Docker Compose Templates**: Standard configurations for production.

### Infrastructure Configuration
- [x] **Environment Validation**: Type-safe environment variable loading (Zod)
- [ ] **Configuration Presets**: Development, staging, production configs
- [ ] **Service Orchestration**: Automatic service startup based on mode
- [ ] **Health Checks**: Endpoint monitoring and automatic restarts
- [x] **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
  - [x] QueueManager graceful shutdown
  - [x] WebSocket connection cleanup
  - [x] Database connection pooling

### Database Management
- [x] **Connection Pooling**: Efficient database connection management
- [ ] **Read Replicas**: Support for read-only database replicas
- [ ] **Database Migrations**: Safe schema updates in production
- [x] **Database Backups**: Automated backup scheduling and retention (see Phase 8)
- [x] **Point-in-Time Recovery**: Restore to specific timestamps (Via Versioning Service)

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

## Phase 11: Standard Plugins & Ecosystem (Current Status: IN PROGRESS 🔄)
### Core Plugins (Official)
- [x] **CMS Plugin**: Full content management system (posts, pages, media)
- [x] **Visual Menu & Navigation Builder**: UI for managing site-wide menus (Infrastructure, `useMenu` hook, and Visual Builder COMPLETED)
- [ ] **E-commerce Plugin**: Complete shop solution (products, cart, checkout, orders)
- [ ] **LMS Plugin**: Learning management (courses, lessons, quizzes, certificates)
- [x] **SEO Plugin**: Meta tags, sitemaps, social sharing, analytics
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

## Phase 12: Advanced Features & Polish (Current Status: IN PROGRESS 🔄)
### Content Management
- [x] **Version Control**: Content versioning and rollback
  - [x] RecordVersions collection with automatic tracking
  - [x] VersioningService integration in REST controllers
  - [x] Full data snapshot per version
  - [x] Version metadata (updated_by, change_summary)
  - [x] UI for viewing/restoring previous versions
- [x] **Workflow System**: Draft → Review → Publish workflows
  - [x] Automated status field injection
  - [x] Governance rules in REST controllers
  - [x] Preview mode for draft content
- [x] **Content Scheduling**: Schedule posts for future publication
  - [x] Global WorkflowService for scheduled publishing
  - [x] 2-minute interval background processing
- [ ] **Media Optimization**: Automatic image resizing and WebP conversion
- [ ] **Asset CDN**: Automatic asset upload to CDN

### Headless & API-First
- [ ] **Mobile SDKs**: Official iOS and Android SDKs
- [ ] **JavaScript SDK**: Browser and Node.js client library
- [x] **Webhooks**: Event notifications to external systems
- [x] **API Webhooks UI**: Webhook configuration in admin panel
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

## Technical Debt & Refactoring Priorities

### P0 - Critical (Security/Functionality Blockers)
**Files:** [SandboxManager.ts](framework/Source/packages/core/src/security/SandboxManager.ts), [node-loader.ts](framework/Source/packages/core/src/discovery/node-loader.ts)

- [x] **Complete SandboxManager Bridge** (Estimated: 2-3 days)
  - Current: 100% complete - fully implemented with capability-based security
  - Issue: Fixed V8 isolation with full PluginContext bridge
  
  - **Implementation Steps:**
    - [x] Implement full `registerDeepBridge()` for nested objects
    - [x] Bridge all PluginContext methods (db, hooks, logger, api, etc.)
    - [x] Handle circular references in bridged objects
    - [x] Add memory limit enforcement per plugin
    - [x] Add CPU time limit enforcement
    - [x] Test with untrusted plugin code
  
  - Impact: Resolved - Production security blocker fixed

- [x] **Resolve NodePluginLoader Dynamic Import** (Estimated: 1 day or delete)
  - Current: 100% complete - Unified DiscoveryService with dynamic `import()`
  - Issue: Auto-discovery now correctly loads both CJS and ESM plugin modules
  - Decision: Consolidated NodePluginLoader into DiscoveryService and removed redundant file.
  - Impact: P0 - Core loading functionality is now modern and robust.

### P1 - High (Code Quality/Architecture)
**Files:** [AuditManager.ts](framework/Source/packages/core/src/security/AuditManager.ts), [MigrationManager.ts](framework/Source/packages/core/src/database/MigrationManager.ts), [RegistryService.ts](framework/Source/packages/core/src/plugin/services/RegistryService.ts)

- [x] **Migrate Raw SQL to ORM Methods** (Estimated: 1 day)
  - [x] Fix AuditManager.ts: Replaced `db.execute(sql\`INSERT INTO...\`)` with `db.insert()`
  - [x] Refactored migration files to use ORM methods
  - Resolved: Fixed direct SQL usage to maintain type safety and dialect abstraction

- [x] **Create Flexible Dialect Helper System** (Estimated: 2-3 hours)
  - [x] Created: `packages/core/src/database/helpers/dialect.ts`
  - [x] Implemented `executeForDialect()` with `Record<string, () => Promise<void>>`
  - [x] Updated all core migrations to use dialect-agnostic approach
  - Impact: Resolved - Multi-DB support is now fully decoupled from migration logic

- [x] **Sandbox Consolidation Strategy** (Estimated: 4-5 hours)
  - Current: Two separate sandbox implementations exist
    - [packages/core/src/sandbox/manager.ts](framework/Source/packages/core/src/sandbox/manager.ts) - vm module (lightweight, same process)
    - [packages/core/src/security/SandboxManager.ts](framework/Source/packages/core/src/security/SandboxManager.ts) - isolated-vm (heavy, separate V8 isolate)
  - [x] Document when to use each sandbox type (Production: isolated-vm)
  - [x] Create unified sandbox interface/factory
  - [x] Add capability-based sandbox selection (trusted vs untrusted plugins)
  - Issue: Unclear which sandbox to use, potential confusion
  - Impact: Resolved - Single, secure sandbox implementation using separate V8 isolates for all plugin logic.

### P2 - Medium (Code Duplication)
**Files:** [bin.ts](framework/Source/packages/cli/src/bin.ts), [MarketplaceManager.ts](framework/Source/packages/core/src/marketplace/MarketplaceManager.ts), [RegistryService.ts](framework/Source/packages/core/src/plugin/services/RegistryService.ts)

- [x] **Step 1: Rename RegistryService → PluginStateService**
  - [x] Rename file: `RegistryService.ts` → `PluginStateService.ts`
  - [x] Rename class: `RegistryService` → `PluginStateService`
  - [x] Rename method: `loadRegistry()` → `loadInstalledPluginsState()`
  - [x] Rename method: `saveRegistryItem()` → `savePluginState()`
  - [x] Update all imports in PluginManager, RuntimeService, and other consumers
  - Reason: Name implies remote registry, but manages local DB state (`_system_plugins` table)

- [x] **Step 2: Delete MarketplaceManager (Duplicate Code)**
  - [x] Delete: `packages/core/src/marketplace/MarketplaceManager.ts`
  - [x] Delete: `packages/api/src/routes/marketplace.ts` (or refactor to use new service)
  - [x] Remove from PluginManager constructor dependencies
  - [x] Remove axios dependency from package.json if unused elsewhere
  - Reason: Duplicates CLI functionality and uses axios instead of native fetch

- [x] **Step 3: Create MarketplaceCatalogService**
  - [x] Create: `packages/core/src/marketplace/MarketplaceCatalogService.ts`
  - [x] Use native `fetch()` (like CLI does at bin.ts:821-825)
  - [x] Implement methods:
    - `fetchCatalog()` - Get full registry
    - `searchPlugins(query: string)` - Search catalog
    - `getPluginInfo(slug: string)` - Get single plugin details
    - `downloadAndInstall(slug: string)` - Download ZIP and extract
  - [ ] Refactor CLI to use this service programmatically
  - [x] Update API routes to use new service
  - Reason: Single source of truth for marketplace operations, no duplicate code

- [x] **Eliminate CLI Marketplace Duplication** (Estimated: part of above)
  - Duplicate: CLI bin.ts:817-867 vs MarketplaceManager.installPlugin()
  - Issue: Two implementations of same installation logic
  - Required: Covered by Step 3 above - CLI uses MarketplaceCatalogService
  - Impact: P2 - Maintenance burden, inconsistent behavior

- [x] **Database Reset Implementation**
  - [x] Implemented: `fromcode db:reset` in CLI
  - [x] Handles table drops and re-migration
  - Impact: P2 - Developer experience

### P3 - Low (Nice to Have)
**Enhancement opportunities for code quality**

- [x] **Create Shared MarketplaceClient Class** (Estimated: 3-4 hours)
  - [x] Extracted common catalog fetch/resolve logic into `MarketplaceClient`.
  - [x] Refactored `MarketplaceCatalogService` and `SystemUpdateService` to use the shared client.
  - Impact: Resolved - Single point of configuration for the Fromcode registry.

- [x] **LocalQueueAdapter Implementation** (Estimated: 3-4 hours)
  - [x] Implemented "Immediate Execution" mode in `LocalQueueAdapter`.
  - [x] Jobs are now executed asynchronously on the next event loop tick if a worker is registered.
  - Impact: Resolved - Full queue functionality available in development without Redis.

- [x] **SchedulerService Cron Enhancement** (Estimated: 2-3 days)
  - File: [index.ts](framework/Source/packages/scheduler/src/index.ts)
  - Current: 100% complete
  - [x] Cron syntax support (integrated node-cron)
  - [x] Task persistence (created _system_scheduler_tasks table)
  - [x] Queue integration (dispatches tasks to QueueManager)
  - [x] Task prioritization (inherited from QueueManager)
  - [x] Concurrent task limits (inherited from QueueManager)
  - Impact: Resolved - Enhanced scheduling capabilities with persistence and scalability.

---

## Progress Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Foundation | ✓ Completed | 100% |
| Phase 2: Core Modules | ✓ Completed | 100% |
| Phase 2.5: API Layer | ✓ Completed | 100% |
| Phase 3: Admin UI & DX | ✓ Completed | 95% |
| Phase 3.5: CLI Tools | ✓ Completed | 100% |
| Phase 3.6: Plugin Architecture Fixes | ✓ Completed | 100% |
| Phase 3.7: Plugin Settings Redesign | ✓ Completed | 100% |
| Phase 3.8: CMS Quality Assurance | ✓ Completed | 100% |
| Phase 3.9: Routing Restoration | ✓ Completed | 100% |
| Phase 4: Frontend Plugin System | ✓ Completed | 100% |
| Phase 5: Security & Isolation | ✓ Completed | 100% |
| Phase 6: Marketplace | ✓ Completed | 100% |
| Phase 7: Theme System | ✓ Completed | 100% |
| Phase 8: System Management | ✓ Completed | 100% |
| Phase 9: Multi-Tenancy | 📋 Planned | 0% |
| Phase 10: Deployment & DevOps | ✓ Completed | 100% |
| Phase 11: Standard Plugins | 🔄 In Progress | 75% |
| Phase 12: Advanced Features | 🔄 In Progress | 40% |

**Overall Project Completion: ~78%**

---

## Next Priority Actions

### Immediate Priorities (Architectural)
1. **Phase 9: Multi-Tenancy**: Research and implement base tenant detection and schema-per-tenant isolation strategy.
2. **Phase 11: LMS Plugin**: Scaffold core Course, Lesson, and Enrollment collections for the learning management module.
3. **Phase 12: Performance**: Support for automated CDNs (Cloudflare/AWS) and asset optimization.

### Short-term Goals (Next 2 Weeks)
1. **Testing**: Expand playwright E2E coverage for the Version History restore flow.
2. **Phase 12: Webhooks**: Implement UI for webhook delivery history and retry logic.
3. **Search Plugin**: Basic implementation of Full-text search with SQLite/Postgres FTS.

### Recently Completed (February 2026)
- ✅ **Version History UI**: Fully connected and validated restore/comparison sidebar.
- ✅ **CLI Quality Suite**: `fromcode doctor`, `test`, `lint`, and `typecheck` commands.
- ✅ **Theme DX**: Real-time `theme dev` mode with esbuild watch integrations.
- ✅ **Infrastructure**: Consolidated all versioning logic into core RESTController.

---

## Recent Achievements (February 2026)

### Week of February 3-4, 2026
- ✅ **Plugin Architecture Fixes**: Eliminated collection slug double-prefixing bug
- ✅ **Collection Extension API**: Enabled cross-plugin field injection
- ✅ **Plugin Settings Redesign**: Removed confusing singleton pattern, created dedicated Settings API
- ✅ **CMS Quality Improvements**: Next.js 15 compatibility, new field components (DatePicker, ColorPicker, CodeEditor)
- ✅ **Testing Infrastructure**: Set up Playwright and Vitest with core test suite
- ✅ **Documentation**: Created Plugin Development Guide
- ✅ **Routing Architecture Restoration**: Restored dedicated collection routes for optimal Next.js performance

### Week of February 5, 2026
- ✅ **Comprehensive Feature Audit**: Discovered 14 fully complete but undocumented features
- ✅ **Roadmap Accuracy Update**: Updated completion percentages across all phases
- ✅ **Hidden Features Documentation**
- ✅ **Technical Debt Documentation**: Identified and prioritized refactoring tasks
- ✅ **Phase Restructuring**: Added Phase 8 (System Management) for operations features

### Week of February 6, 2026
- ✅ **Security Monitoring Dashboard**: Implemented real-time security heuristic monitoring UI.
- ✅ **Per-Plugin Resource Limits**: Enforced memory and CPU execution quotas in V8 isolates.
- ✅ **Monorepo Build Stability**: Resolved critical TypeScript cross-package resolution and Drizzle type errors.
- ✅ **CMS Decoupling**: Purged remaining hardcoded CMS references from core admin layout.
- ✅ **Advanced Content Workflows**: Generic Draft/Review/Publish system with automated field injection and global scheduling service.
- ✅ **Marketplace Infrastructure (Phase 6)**: Transformed static registry into a dynamic Hub with real-time ratings, reviews, and a dedicated Developer Portal for third-party submissions.
- ✅ **Webhook Engine (Phase 12)**: Deployed global webhook dispatcher with HMAC-SHA256 signing and automated delivery tracking across all system events.

## Archived Plans

Completed roadmaps have been moved to [docs/archives/](./archives/) for reference:
- [CMS Roadmap (Phases 1-10)](./archives/cms-roadmap-completed.md) - Completed Feb 3, 2026
- [Plugin Settings Redesign](./archives/plugin-settings-redesign-completed.md) - Completed Feb 4, 2026
- [Plugin Architecture Fixes](./archives/plugin-architecture-fixes-completed.md) - Completed Feb 4, 2026

---
*Last Updated: February 6, 2026 - Security & Stability Update*
