# Fromcode Framework - Complete Architecture Plan

## Executive Summary

**Vision:** Build the "WordPress of TypeScript" - a plugin-first, enterprise-grade framework with a thriving ecosystem, marketplace, and developer community.

**Problem Statement:**
- Payload CMS & Strapi: Limited plugin systems, vendor lock-in, poor extensibility
- WordPress: Excellent ecosystem but outdated tech (PHP, poor TypeScript support)
- Gap: No TypeScript-native framework with WordPress-level extensibility

**Solution: Fromcode Framework**
- Full TypeScript stack (type-safe plugins, APIs, frontend)
- WordPress-inspired plugin architecture with modern improvements
- Secure admin panel with granular permissions
- Plugin marketplace & registry system
- Developer-first DX with CLI tools and generators

---

## 1. Framework Architecture

### 1.1 Core Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                     FROMCODE FRAMEWORK                       │
├─────────────────────────────────────────────────────────────┤
│  Principle 1: PLUGIN-FIRST                                  │
│  - Core is minimal, everything else is a plugin            │
│  - Plugins can extend EVERYTHING                            │
│                                                              │
│  Principle 2: TYPE-SAFE                                     │
│  - Full TypeScript throughout                               │
│  - Runtime + compile-time validation                        │
│                                                              │
│  Principle 3: SECURE BY DEFAULT                            │
│  - Permission system for all operations                     │
│  - Plugin sandboxing & capability model                     │
│                                                              │
│  Principle 4: DEVELOPER-FRIENDLY                           │
│  - Best-in-class DX with CLI tools                         │
│  - Hot reload, debugging, testing built-in                  │
│                                                              │
│  Principle 5: ECOSYSTEM-DRIVEN                             │
│  - Marketplace for plugins & themes                         │
│  - Revenue sharing for developers                           │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 High-Level Architecture

```typescript
// Monorepo Structure
fromcode-framework/
├── packages/
│   ├── core/              // Minimal kernel (plugin loader, security, DI)
│   ├── cli/               // Developer tooling (fromcode create, fromcode dev)
│   ├── sdk/               // Plugin development SDK
│   ├── api/               // REST/GraphQL API layer
│   ├── admin/             // Admin panel (React/Next.js)
│   ├── database/          // Database abstraction (supports Postgres, MySQL, SQLite)
│   ├── auth/              // Authentication module (JWT, sessions, OAuth)
│   └── marketplace-client/ // Marketplace integration
│
├── plugins/               // Official plugins (curated, high-quality)
│   ├── users/
│   ├── auth/
│   ├── cms/
│   ├── lms/
│   ├── ecommerce/
│   ├── mlm/
│   └── ...
│
├── starters/              // Starter templates
│   ├── blog/
│   ├── ecommerce/
│   ├── saas/
│   └── marketplace/
│
├── docs/                  // Documentation site
└── marketplace/           // Marketplace backend + frontend
```

---

## 2. Plugin System Architecture

### 2.1 Plugin Lifecycle

```typescript
// Plugin Manifest (plugin.json)
interface PluginManifest {
  // Identity
  slug: string                    // Unique identifier
  name: string                    // Human-readable name
  version: string                 // Semver version
  
  // Metadata
  description: string
  author: string | Author
  license: string
  homepage?: string
  repository?: string
  
  // Dependencies
  dependencies?: {
    [pluginSlug: string]: string  // Semver range
  }
  peerDependencies?: {
    'fromcode': string            // Framework version compatibility
  }
  
  // Capabilities & Permissions
  capabilities: PluginCapability[]
  permissions: Permission[]
  
  // Hooks & Extensions
  hooks?: HookRegistration[]
  api?: APIRegistration
  admin?: AdminPanelExtension
  database?: DatabaseExtension
  
  // Migration & Installation
  migrations?: string             // Path to migrations folder
  seeds?: string                  // Path to seed data
  installScript?: string          // Post-install script
  
  // Marketplace
  category: PluginCategory
  tags?: string[]
  screenshots?: string[]
  price?: number                  // 0 = free
  
  // Security
  signature?: string              // Cryptographic signature
  checksum?: string
}

// Plugin Capabilities (declare what plugin can do)
enum PluginCapability {
  DATABASE_READ = 'database:read',
  DATABASE_WRITE = 'database:write',
  DATABASE_SCHEMA = 'database:schema',
  API_ROUTES = 'api:routes',
  API_MIDDLEWARE = 'api:middleware',
  ADMIN_UI = 'admin:ui',
  ADMIN_MENU = 'admin:menu',
  HOOKS = 'hooks',
  CRON = 'cron',
  FILE_SYSTEM = 'filesystem',
  NETWORK = 'network',
  PROCESS = 'process',
  COLLECTIONS = 'collections:modify',
  GLOBALS = 'globals:modify',
  PLUGINS = 'plugins:interact',
}

// Plugin Entry Point (index.ts)
export interface FromcodePlugin {
  (options?: PluginOptions): Plugin
}

export interface Plugin {
  name: string
  version: string
  
  // Lifecycle hooks
  onInstall?: (context: PluginContext) => Promise<void>
  onEnable?: (context: PluginContext) => Promise<void>
  onDisable?: (context: PluginContext) => Promise<void>
  onUninstall?: (context: PluginContext) => Promise<void>
  
  // Configuration hook
  configure?: (config: FrameworkConfig) => FrameworkConfig
  
  // Extension points
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]
  endpoints?: EndpointConfig[]
  hooks?: HookConfig[]
  admin?: AdminExtension
  
  // Background tasks
  jobs?: JobConfig[]
}
```

### 2.2 Plugin Context & Dependency Injection

```typescript
// Every plugin receives a context with scoped capabilities
interface PluginContext {
  // Core services
  readonly db: DatabaseService       // Scoped to plugin's permissions
  readonly api: APIService           // Register routes, middleware
  readonly hooks: HookService        // Emit and listen to events
  readonly logger: LoggerService     // Namespaced logger
  readonly cache: CacheService       // Plugin-scoped cache
  readonly storage: StorageService   // File storage
  
  // Plugin metadata
  readonly plugin: {
    slug: string
    version: string
    dataDir: string                  // Plugin data directory
    config: Record<string, any>      // User config
  }
  
  // Inter-plugin communication
  readonly plugins: {
    isEnabled(slug: string): boolean
    getAPI(slug: string): any        // Get public API of another plugin
    emit(event: string, data: any): void
    on(event: string, handler: Function): void
  }
  
  // Admin panel
  readonly admin: {
    addMenuItem(item: MenuItem): void
    addWidget(widget: Widget): void
    addRoute(route: AdminRoute): void
  }
  
  // Security
  readonly auth: {
    hasPermission(user: User, permission: string): boolean
    requirePermission(permission: string): Middleware
  }
}
```

### 2.3 Plugin Communication

```typescript
// Event-driven architecture for plugin communication
class PluginBus {
  // Global events
  emit(event: string, payload: any): void
  on(event: string, handler: Function): Unsubscribe
  
  // Plugin-to-plugin direct calls
  call(pluginSlug: string, method: string, ...args: any[]): Promise<any>
}

// Example: CMS plugin exposes API for other plugins
// plugins/cms/index.ts
export const cmsPlugin: FromcodePlugin = () => ({
  name: 'cms',
  
  // Expose public API
  publicAPI: {
    createPost: async (data: PostData) => { /* ... */ },
    getPosts: async (query: Query) => { /* ... */ },
  },
  
  // React to other plugins
  onEnable: async (ctx) => {
    // Listen to events from other plugins
    ctx.plugins.on('ecommerce:order.created', async (order) => {
      // Create a blog post about new product launch
    })
  }
})

// plugins/ecommerce/index.ts
export const ecommercePlugin: FromcodePlugin = () => ({
  name: 'ecommerce',
  
  configure: async (ctx) => {
    // Check if CMS plugin is available
    if (ctx.plugins.isEnabled('cms')) {
      const cms = ctx.plugins.getAPI('cms')
      
      // Use CMS API
      await cms.createPost({
        title: 'New Product Released!',
        content: '...'
      })
    }
  }
})
```

---

## 3. Security Architecture

### 3.1 Multi-Layer Security Model

```typescript
// Layer 1: Plugin Sandboxing
interface PluginSandbox {
  // Each plugin runs in isolated context
  vm: VM                          // V8 isolate or worker thread
  permissions: PermissionSet      // Granted capabilities
  resourceLimits: {
    memory: number                // Max memory usage
    cpu: number                   // CPU time limit
    diskSpace: number             // Storage quota
    networkCalls: number          // Rate limit
  }
}

// Layer 2: Capability-Based Security
class CapabilitySystem {
  // Plugins must declare what they need
  async requestCapability(
    plugin: Plugin,
    capability: PluginCapability
  ): Promise<boolean> {
    // 1. Check if declared in manifest
    if (!plugin.manifest.capabilities.includes(capability)) {
      return false
    }
    
    // 2. User approval for sensitive capabilities
    if (SENSITIVE_CAPABILITIES.includes(capability)) {
      return await this.requestUserApproval(plugin, capability)
    }
    
    // 3. Grant with monitoring
    await this.grantCapability(plugin, capability)
    return true
  }
}

// Layer 3: API Security
interface SecurityMiddleware {
  // JWT-based authentication
  authenticate: (req: Request) => Promise<User>
  
  // Role-based access control
  authorize: (user: User, resource: string, action: string) => boolean
  
  // Rate limiting
  rateLimit: (key: string, limit: number, window: number) => boolean
  
  // Input validation
  validate: (schema: Schema, data: any) => ValidationResult
  
  // CSRF protection
  csrfProtection: () => Middleware
  
  // SQL injection prevention (parameterized queries only)
  sanitize: (input: string) => string
}

// Layer 4: Plugin Signature Verification
class PluginVerifier {
  async verifyPlugin(plugin: PluginPackage): Promise<boolean> {
    // 1. Check cryptographic signature
    const signatureValid = await this.verifySignature(
      plugin.manifest,
      plugin.signature,
      plugin.author.publicKey
    )
    
    // 2. Verify checksum
    const checksumValid = await this.verifyChecksum(plugin)
    
    // 3. Scan for malicious code (optional)
    const scanResult = await this.securityScan(plugin)
    
    return signatureValid && checksumValid && scanResult.clean
  }
}
```

### 3.2 Permission System

```typescript
// Fine-grained permission system
enum Permission {
  // User management
  USERS_READ = 'users:read',
  USERS_WRITE = 'users:write',
  USERS_DELETE = 'users:delete',
  
  // Content
  CONTENT_READ = 'content:read',
  CONTENT_WRITE = 'content:write',
  CONTENT_PUBLISH = 'content:publish',
  CONTENT_DELETE = 'content:delete',
  
  // Plugin management
  PLUGINS_INSTALL = 'plugins:install',
  PLUGINS_UNINSTALL = 'plugins:uninstall',
  PLUGINS_CONFIGURE = 'plugins:configure',
  
  // System
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_BACKUP = 'system:backup',
  SYSTEM_LOGS = 'system:logs',
  
  // Database
  DATABASE_READ = 'database:read',
  DATABASE_WRITE = 'database:write',
  DATABASE_ADMIN = 'database:admin',
  
  // API
  API_READ = 'api:read',
  API_WRITE = 'api:write',
}

// Role system
interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  inherits?: string[]             // Role inheritance
}

// Built-in roles
const DEFAULT_ROLES: Role[] = [
  {
    id: 'super-admin',
    name: 'Super Administrator',
    description: 'Full system access',
    permissions: [Permission.ALL],
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Administrative access',
    permissions: [
      Permission.USERS_READ,
      Permission.USERS_WRITE,
      Permission.CONTENT_ALL,
      Permission.PLUGINS_CONFIGURE,
    ],
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Content management',
    permissions: [
      Permission.CONTENT_READ,
      Permission.CONTENT_WRITE,
      Permission.CONTENT_PUBLISH,
    ],
  },
  {
    id: 'author',
    name: 'Author',
    description: 'Content creation',
    permissions: [
      Permission.CONTENT_READ,
      Permission.CONTENT_WRITE,
    ],
  },
]
```

---

## 4. Admin Panel Architecture

### 4.1 Modern Admin UI

```typescript
// Admin panel built with React/Next.js
// packages/admin/

// Extensible admin architecture
interface AdminExtension {
  // Add menu items
  menus?: MenuItem[]
  
  // Add dashboard widgets
  widgets?: Widget[]
  
  // Add settings panels
  settingsPanels?: SettingsPanel[]
  
  // Add custom pages/routes
  routes?: AdminRoute[]
  
  // Add bulk actions for collections
  bulkActions?: BulkAction[]
  
  // Add quick actions
  quickActions?: QuickAction[]
  
  // Customize admin layout
  layout?: LayoutCustomization
}

// Example: Plugin adds admin menu
export const myPlugin: FromcodePlugin = () => ({
  name: 'my-plugin',
  
  admin: {
    menus: [
      {
        label: 'My Plugin',
        icon: 'Plugin',
        position: 100,
        children: [
          {
            label: 'Dashboard',
            href: '/admin/my-plugin',
            icon: 'Dashboard',
          },
          {
            label: 'Settings',
            href: '/admin/my-plugin/settings',
            icon: 'Settings',
            permission: 'my-plugin:configure',
          },
        ],
      },
    ],
    
    // Add dashboard widget
    widgets: [
      {
        id: 'my-plugin-stats',
        title: 'My Plugin Stats',
        component: () => import('./admin/widgets/StatsWidget'),
        position: 'top-right',
        permissions: ['my-plugin:read'],
      },
    ],
    
    // Add settings panel
    settingsPanels: [
      {
        id: 'my-plugin-settings',
        label: 'My Plugin',
        component: () => import('./admin/panels/SettingsPanel'),
        category: 'plugins',
      },
    ],
  },
})
```

### 4.2 Admin Features

```typescript
// Core admin features
interface AdminCore {
  // Dashboard
  dashboard: {
    widgets: Widget[]              // Customizable widgets
    quickActions: QuickAction[]    // Quick action buttons
    statistics: StatCard[]         // Overview stats
  }
  
  // Content management
  collections: {
    list: CollectionListView       // Filterable, sortable tables
    create: CollectionCreateForm   // Dynamic form builder
    edit: CollectionEditForm       // Inline editing
    bulkActions: BulkAction[]      // Bulk operations
  }
  
  // Media library
  media: {
    upload: MediaUploader          // Drag & drop upload
    browse: MediaBrowser           // Grid/list view
    organize: FolderStructure      // Folder organization
    edit: MediaEditor              // Image editing
  }
  
  // Plugin management
  plugins: {
    marketplace: PluginMarketplace // Browse & install plugins
    installed: PluginList          // Manage installed plugins
    updates: UpdateManager         // Update plugins
    config: PluginConfigurator     // Configure plugins
  }
  
  // User management
  users: {
    list: UserList                 // User directory
    roles: RoleManager             // Role management
    permissions: PermissionEditor  // Fine-grained permissions
  }
  
  // System settings
  system: {
    general: GeneralSettings       // Site info, URLs
    api: APISettings               // API keys, CORS
    email: EmailSettings           // SMTP config
    storage: StorageSettings       // File storage
    cache: CacheSettings           // Cache config
    backups: BackupManager         // Backup & restore
    logs: LogViewer                // System logs
  }
  
  // Developer tools
  developer: {
    api: APIExplorer               // GraphQL/REST explorer
    webhooks: WebhookManager       // Webhook config
    migrations: MigrationRunner    // Run migrations
    console: DevConsole            // Debug console
  }
}
```

---

## 5. Frontend Plugin Architecture (CRITICAL)

### 5.1 The Frontend Challenge

**Problem:** How do backend plugins automatically affect the frontend without requiring manual code changes?

**Solution:** Multi-layer frontend integration system with server-side and client-side plugin loading.

### 5.2 Frontend Integration Strategies

```typescript
// plugins can integrate with frontend through 5 mechanisms:

interface FrontendPluginIntegration {
  // 1. Server-Side Rendering (SSR) Injection
  ssr?: {
    headInjection?: HeadInjection[]      // Meta tags, scripts, styles
    bodyInjection?: BodyInjection[]      // Scripts, analytics
    middleware?: NextMiddleware[]         // Request/response manipulation
  }
  
  // 2. Component Slot System
  slots?: {
    [slotName: string]: ComponentRegistration
  }
  
  // 3. Route Injection
  routes?: {
    pages?: PageRoute[]                   // Full page routes
    api?: APIRoute[]                      // API endpoints
  }
  
  // 4. Client-Side Scripts
  clientScripts?: {
    scripts?: ScriptRegistration[]        // JavaScript files
    styles?: StyleRegistration[]          // CSS files
    priority?: number                     // Load order
  }
  
  // 5. React Component Overrides
  components?: {
    [componentPath: string]: ComponentOverride
  }
}
```

### 5.3 Example: SEO Plugin Integration

```typescript
// plugins/seo/index.ts
export const seoPlugin: FromcodePlugin = () => ({
  name: 'seo',
  version: '1.0.0',
  
  // Backend collections
  collections: [
    {
      slug: 'seo-settings',
      fields: [
        { name: 'defaultTitle', type: 'text' },
        { name: 'defaultDescription', type: 'text' },
        { name: 'ogImage', type: 'upload' },
        { name: 'twitterCard', type: 'select' },
      ],
    },
  ],
  
  // Frontend integration
  frontend: {
    // 1. SSR Head Injection
    ssr: {
      headInjection: [
        {
          priority: 1,
          handler: async (context: RenderContext) => {
            const seoSettings = await context.db.findOne('seo-settings')
            
            return {
              meta: [
                { name: 'description', content: seoSettings.defaultDescription },
                { property: 'og:title', content: seoSettings.defaultTitle },
                { property: 'og:image', content: seoSettings.ogImage },
              ],
              link: [
                { rel: 'canonical', href: context.url },
              ],
              script: [
                {
                  type: 'application/ld+json',
                  children: JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'WebSite',
                    name: seoSettings.defaultTitle,
                  }),
                },
              ],
            }
          },
        },
      ],
      
      // Middleware for redirects, canonical URLs, etc.
      middleware: [
        async (req, res, next) => {
          // Handle 301 redirects
          const redirect = await findRedirect(req.path)
          if (redirect) {
            return res.redirect(301, redirect.target)
          }
          next()
        },
      ],
    },
    
    // 2. Client-side scripts (optional)
    clientScripts: {
      scripts: [
        {
          src: '/plugins/seo/client/analytics.js',
          async: true,
          position: 'beforeBodyEnd',
        },
      ],
    },
    
    // 3. Component slots (for admin UI)
    slots: {
      'admin.post.edit.sidebar': () => import('./components/SEOMetaBox'),
      'admin.settings.seo': () => import('./components/SEOSettings'),
    },
  },
})
```

### 5.4 Server-Side Rendering (SSR) Architecture

```typescript
// Core framework's render pipeline
// packages/frontend/lib/render-pipeline.ts

class RenderPipeline {
  private plugins: LoadedPlugin[]
  
  async renderPage(url: string, context: RenderContext): Promise<HTML> {
    // 1. Collect all SSR injections from enabled plugins
    const injections = await this.collectSSRInjections(context)
    
    // 2. Execute middleware chain
    await this.executeMiddleware(context)
    
    // 3. Render React components with slots
    const pageContent = await this.renderComponents(url, context)
    
    // 4. Inject head elements (sorted by priority)
    const head = this.buildHead(injections, context)
    
    // 5. Inject body scripts
    const body = this.buildBody(pageContent, injections)
    
    // 6. Return complete HTML
    return `
      <!DOCTYPE html>
      <html>
        <head>
          ${head}
        </head>
        <body>
          ${body}
        </body>
      </html>
    `
  }
  
  private async collectSSRInjections(context: RenderContext) {
    const injections: SSRInjection[] = []
    
    // Get all enabled plugins
    const enabledPlugins = await this.getEnabledPlugins()
    
    for (const plugin of enabledPlugins) {
      if (plugin.frontend?.ssr?.headInjection) {
        for (const injection of plugin.frontend.ssr.headInjection) {
          const result = await injection.handler(context)
          injections.push({
            plugin: plugin.slug,
            priority: injection.priority || 100,
            data: result,
          })
        }
      }
    }
    
    // Sort by priority (lower = earlier)
    return injections.sort((a, b) => a.priority - b.priority)
  }
}
```

### 5.5 Component Slot System

```typescript
// Core concept: Predefined extension points throughout the app

// packages/frontend/components/SlotRenderer.tsx
import { usePlugins } from '@/contexts/PluginsContext'

interface SlotProps {
  name: string                    // Slot identifier
  fallback?: React.ReactNode      // Default content
  props?: Record<string, any>     // Props passed to plugin components
}

export function Slot({ name, fallback, props }: SlotProps) {
  const { getSlotComponents } = usePlugins()
  const components = getSlotComponents(name)
  
  if (components.length === 0) {
    return fallback || null
  }
  
  return (
    <>
      {components.map((Component, index) => (
        <Component key={index} {...props} />
      ))}
    </>
  )
}

// Usage in your app:
// app/[slug]/page.tsx
export default function Page({ params }) {
  return (
    <div>
      {/* Core content */}
      <article>
        <h1>{page.title}</h1>
        
        {/* Plugin injection point - SEO plugin can inject meta box here */}
        <Slot name="page.header.after" props={{ page }} />
        
        <div>{page.content}</div>
        
        {/* Another injection point - Comments, share buttons, etc. */}
        <Slot name="page.content.after" props={{ page }} />
      </article>
      
      {/* Sidebar slot - Plugins can add widgets */}
      <aside>
        <Slot name="page.sidebar" props={{ page }} />
      </aside>
    </div>
  )
}
```

### 5.6 Predefined Slot System

```typescript
// packages/core/slots.ts
// Standardized slot names throughout the framework

export const CORE_SLOTS = {
  // Document-level
  'document.head.start': 'Inject at start of <head>',
  'document.head.end': 'Inject at end of <head>',
  'document.body.start': 'Inject at start of <body>',
  'document.body.end': 'Inject at end of <body>',
  
  // Layout
  'layout.header.before': 'Before main header',
  'layout.header.after': 'After main header',
  'layout.footer.before': 'Before footer',
  'layout.footer.after': 'After footer',
  'layout.sidebar.start': 'Start of sidebar',
  'layout.sidebar.end': 'End of sidebar',
  
  // Page-level
  'page.header.before': 'Before page title',
  'page.header.after': 'After page title',
  'page.content.before': 'Before main content',
  'page.content.after': 'After main content',
  
  // Post/Article
  'post.meta.before': 'Before post metadata',
  'post.meta.after': 'After post metadata',
  'post.content.before': 'Before post content',
  'post.content.after': 'After post content (comments, share)',
  
  // E-commerce
  'product.price.after': 'After product price',
  'product.addtocart.before': 'Before add to cart button',
  'cart.items.after': 'After cart items',
  'checkout.payment.before': 'Before payment options',
  
  // Admin
  'admin.dashboard.widgets': 'Dashboard widget area',
  'admin.menu.main': 'Main admin menu',
  'admin.menu.settings': 'Settings submenu',
  'admin.toolbar': 'Admin toolbar',
  
  // Forms
  'form.field.before': 'Before form field',
  'form.field.after': 'After form field',
  'form.submit.before': 'Before submit button',
  'form.submit.after': 'After submit button',
}
```

### 5.7 Client-Side Plugin Loading

```typescript
// packages/frontend/contexts/PluginsContext.tsx
import { createContext, useContext, useEffect, useState } from 'react'

interface PluginContextValue {
  plugins: PluginManifest[]
  getSlotComponents: (slot: string) => React.ComponentType[]
  isPluginEnabled: (slug: string) => boolean
}

const PluginContext = createContext<PluginContextValue>(null!)

export function PluginsProvider({ children }) {
  const [plugins, setPlugins] = useState<PluginManifest[]>([])
  const [slotRegistry, setSlotRegistry] = useState<Map<string, React.ComponentType[]>>(new Map())
  
  useEffect(() => {
    // Fetch enabled plugins from API
    fetch('/api/plugins/active')
      .then(res => res.json())
      .then(data => {
        setPlugins(data.plugins)
        loadPluginComponents(data.plugins)
      })
  }, [])
  
  async function loadPluginComponents(plugins: string[]) {
    const registry = new Map<string, React.ComponentType[]>()
    
    for (const pluginSlug of plugins) {
      try {
        // Dynamic import of plugin's frontend bundle
        const module = await import(`@/plugins/${pluginSlug}/frontend`)
        
        if (module.slots) {
          for (const [slotName, component] of Object.entries(module.slots)) {
            if (!registry.has(slotName)) {
              registry.set(slotName, [])
            }
            registry.get(slotName)!.push(component as React.ComponentType)
          }
        }
        
        // Load plugin's CSS if exists
        if (module.styles) {
          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = `/plugins/${pluginSlug}/styles.css`
          document.head.appendChild(link)
        }
        
        // Execute plugin initialization
        if (module.init) {
          await module.init()
        }
      } catch (error) {
        console.error(`Failed to load plugin ${pluginSlug}:`, error)
      }
    }
    
    setSlotRegistry(registry)
  }
  
  const getSlotComponents = (slot: string) => {
    return slotRegistry.get(slot) || []
  }
  
  const isPluginEnabled = (slug: string) => {
    return plugins.includes(slug)
  }
  
  return (
    <PluginContext.Provider value={{ plugins, getSlotComponents, isPluginEnabled }}>
      {children}
    </PluginContext.Provider>
  )
}

export const usePlugins = () => useContext(PluginContext)
```

### 5.8 Plugin Frontend Bundle Structure

```typescript
// Plugin frontend code structure
// plugins/seo/frontend/index.ts

export const slots = {
  // Inject SEO preview in post editor
  'admin.post.edit.sidebar': () => import('./components/SEOPreview'),
  
  // Add meta description field to pages
  'page.meta.after': () => import('./components/MetaDescription'),
}

export const styles = '/plugins/seo/frontend/styles.css'

// Client-side initialization
export async function init() {
  console.log('[SEO Plugin] Initializing client-side features')
  
  // Initialize analytics tracking
  if (window.gtag) {
    // Setup Google Analytics
  }
  
  // Monitor page views
  window.addEventListener('routeChange', (e) => {
    trackPageView(e.detail.url)
  })
}

// Expose public API for other plugins
export const api = {
  trackEvent: (event: string, data: any) => {
    // Track custom events
  },
  
  updateMetaTags: (tags: MetaTags) => {
    // Dynamically update meta tags
  },
}
```

### 5.9 Build-Time vs Runtime Plugin Loading

```typescript
// Two approaches for frontend plugin loading:

// Approach 1: Build-Time (Better Performance)
// - Plugins compiled into main bundle
// - No runtime overhead
// - Requires rebuild when plugins change
// - Best for production

// next.config.js
const enabledPlugins = getEnabledPlugins() // From DB or config

module.exports = {
  webpack: (config) => {
    // Dynamically add plugin aliases
    config.resolve.alias = {
      ...config.resolve.alias,
      ...enabledPlugins.reduce((aliases, plugin) => {
        aliases[`@plugin/${plugin}`] = path.resolve(__dirname, `plugins/${plugin}/frontend`)
        return aliases
      }, {}),
    }
    return config
  },
}

// Approach 2: Runtime Loading (More Flexible)
// - Plugins loaded dynamically via API
// - Enable/disable without rebuild
// - Small runtime overhead
// - Best for development

// We recommend HYBRID approach:
interface PluginLoadingStrategy {
  // Core plugins: Build-time (always needed)
  buildTime: string[]  // ['core', 'users', 'auth']
  
  // Optional plugins: Runtime (dynamic)
  runtime: string[]    // ['seo', 'analytics', 'comments']
}
```

### 5.10 Complete SEO Plugin Example

```typescript
// Full working example showing backend + frontend integration

// plugins/seo/plugin.json
{
  "name": "SEO Plugin",
  "slug": "seo",
  "version": "1.0.0",
  "category": "seo",
  "capabilities": [
    "database:read",
    "database:write",
    "admin:ui",
    "hooks"
  ]
}

// plugins/seo/index.ts (Backend)
export const seoPlugin: FromcodePlugin = () => ({
  name: 'seo',
  
  // Add SEO fields to all content collections
  hooks: [
    {
      collection: '*',  // Apply to all collections
      hook: 'beforeRead',
      handler: async (doc) => {
        // Inject SEO metadata
        return {
          ...doc,
          seo: await getSEOMetadata(doc),
        }
      },
    },
  ],
  
  // API endpoint for sitemap
  endpoints: [
    {
      path: '/sitemap.xml',
      method: 'get',
      handler: async (req, res) => {
        const pages = await req.payload.find({ collection: 'pages' })
        const xml = generateSitemap(pages)
        res.header('Content-Type', 'application/xml')
        res.send(xml)
      },
    },
  ],
  
  // Frontend integration
  frontend: {
    // SSR injection for meta tags
    ssr: {
      headInjection: [
        {
          priority: 1,
          handler: async (context) => {
            const page = context.page
            const seo = page?.seo || {}
            
            return {
              title: seo.title || page?.title,
              meta: [
                { name: 'description', content: seo.description },
                { property: 'og:title', content: seo.ogTitle },
                { property: 'og:description', content: seo.ogDescription },
                { property: 'og:image', content: seo.ogImage },
                { name: 'twitter:card', content: seo.twitterCard },
                { name: 'robots', content: seo.robots },
              ],
              link: [
                { rel: 'canonical', href: seo.canonical || context.url },
              ],
              script: [
                {
                  type: 'application/ld+json',
                  children: JSON.stringify(seo.structuredData),
                },
              ],
            }
          },
        },
      ],
    },
    
    // Client-side tracking
    clientScripts: {
      scripts: [
        {
          src: '/plugins/seo/frontend/tracking.js',
          async: true,
        },
      ],
    },
    
    // Component slots
    slots: {
      'admin.post.edit.sidebar': './components/SEOMetaBox',
      'admin.settings.seo': './components/SEOSettings',
    },
  },
})

// plugins/seo/frontend/components/SEOMetaBox.tsx
export default function SEOMetaBox({ post }) {
  const [seo, setSeo] = useState(post.seo || {})
  
  return (
    <div className="seo-metabox">
      <h3>SEO Settings</h3>
      
      <input
        type="text"
        placeholder="SEO Title"
        value={seo.title}
        onChange={(e) => setSeo({ ...seo, title: e.target.value })}
      />
      
      <textarea
        placeholder="Meta Description"
        value={seo.description}
        onChange={(e) => setSeo({ ...seo, description: e.target.value })}
      />
      
      <div className="seo-preview">
        <h4>Google Preview:</h4>
        <div className="google-result">
          <h5>{seo.title || post.title}</h5>
          <p className="url">{getPageUrl(post)}</p>
          <p className="description">{seo.description}</p>
        </div>
      </div>
    </div>
  )
}
```

### 5.11 Plugin Frontend Build System

```bash
# Each plugin has its own frontend build

plugins/seo/
├── plugin.json
├── index.ts              # Backend entry
├── frontend/             # Frontend code
│   ├── index.ts          # Frontend entry
│   ├── components/
│   ├── hooks/
│   ├── styles.css
│   └── package.json      # Frontend dependencies
└── dist/
    └── frontend/         # Built frontend bundle
        ├── index.js
        ├── index.css
        └── assets/

# Build command
$ fromcode plugin build seo --frontend

# Output: plugins/seo/dist/frontend/
# Framework automatically serves from: /plugins/seo/frontend/*
```

### 5.12 Plugin Communication on Frontend

```typescript
// Plugins can communicate on the frontend too

// In your main app
import { usePlugin } from '@fromcode/hooks'

function MyComponent() {
  const seoPlugin = usePlugin('seo')
  const analyticsPlugin = usePlugin('analytics')
  
  const handleClick = () => {
    // Use SEO plugin API
    seoPlugin?.api.trackEvent('button_click', { button: 'subscribe' })
    
    // Use Analytics plugin API
    analyticsPlugin?.api.track('conversion', { type: 'newsletter' })
  }
  
  return <button onClick={handleClick}>Subscribe</button>
}

// Plugin can listen to events
// plugins/analytics/frontend/index.ts
export function init() {
  // Listen to SEO plugin events
  window.fromcode.plugins.on('seo:pageview', (data) => {
    // Track in analytics
    trackPageView(data)
  })
}
```

---

## 6. API Architecture

### 6.1 Dual API Support

```typescript
// REST API (default)
interface RESTAPIConfig {
  basePath: '/api'
  version: 'v1'
  
  // Auto-generated CRUD endpoints for collections
  collections: {
    [collectionSlug: string]: {
      list: 'GET /api/v1/:collection'
      get: 'GET /api/v1/:collection/:id'
      create: 'POST /api/v1/:collection'
      update: 'PATCH /api/v1/:collection/:id'
      delete: 'DELETE /api/v1/:collection/:id'
    }
  }
  
  // Custom endpoints from plugins
  endpoints: EndpointConfig[]
}

// GraphQL API (optional)
interface GraphQLAPIConfig {
  path: '/graphql'
  
  // Auto-generated schema from collections
  schema: GraphQLSchema
  
  // Plugin extensions
  resolvers: Resolver[]
  mutations: Mutation[]
  subscriptions: Subscription[]
}

// WebSocket API (real-time)
interface WebSocketAPI {
  path: '/ws'
  
  // Real-time features
  subscriptions: {
    collections: boolean           // Subscribe to collection changes
    plugins: boolean               // Plugin events
    system: boolean                // System events
  }
}
```

### 5.2 API Security

```typescript
// API authentication methods
enum AuthMethod {
  JWT = 'jwt',                     // Token-based
  SESSION = 'session',             // Cookie-based
  API_KEY = 'api-key',             // API key
  OAUTH = 'oauth',                 // OAuth 2.0
}

// API rate limiting
interface RateLimitConfig {
  global: {
    requests: 1000,
    window: '15m',
  },
  authenticated: {
    requests: 5000,
    window: '15m',
  },
  perEndpoint: {
    [endpoint: string]: {
      requests: number
      window: string
    }
  }
}

// API versioning
interface APIVersioning {
  strategy: 'url' | 'header' | 'accept'
  current: 'v1'
  supported: ['v1']
  deprecated: []
}
```

---

## 7. Plugin Marketplace & Registry

### 7.1 Marketplace Architecture

```typescript
// Marketplace backend
interface MarketplaceAPI {
  // Plugin discovery
  search(query: string, filters: Filters): Promise<Plugin[]>
  browse(category: Category, page: number): Promise<Plugin[]>
  featured(): Promise<Plugin[]>
  trending(): Promise<Plugin[]>
  
  // Plugin details
  getPlugin(slug: string): Promise<PluginDetail>
  getVersions(slug: string): Promise<Version[]>
  getReviews(slug: string): Promise<Review[]>
  
  // Installation
  download(slug: string, version: string): Promise<PluginPackage>
  verify(package: PluginPackage): Promise<boolean>
  
  // Publishing (for developers)
  publish(plugin: PluginPackage): Promise<PublishResult>
  update(slug: string, version: string): Promise<UpdateResult>
  
  // Analytics
  trackInstall(slug: string): Promise<void>
  trackUninstall(slug: string): Promise<void>
  reportUsage(slug: string, metrics: Metrics): Promise<void>
}

// Plugin listing
interface PluginListing {
  slug: string
  name: string
  tagline: string
  description: string
  
  // Media
  icon: string
  banner: string
  screenshots: string[]
  video?: string
  
  // Metadata
  author: Author
  category: Category
  tags: string[]
  version: string
  lastUpdated: Date
  
  // Stats
  downloads: number
  activeInstalls: number
  rating: number
  reviewCount: number
  
  // Pricing
  price: number
  pricingModel: 'free' | 'one-time' | 'subscription'
  trial?: {
    duration: number
    features: string[]
  }
  
  // Compatibility
  minFrameworkVersion: string
  maxFrameworkVersion?: string
  requiredPlugins: string[]
  testedUpTo: string
  
  // Support
  documentation: string
  support: string
  changelog: string
}
```

### 7.2 Developer Portal

```typescript
// Developer features
interface DeveloperPortal {
  // Plugin management
  myPlugins: Plugin[]
  createPlugin(): PluginDraft
  publishPlugin(draft: PluginDraft): Promise<PublishResult>
  updatePlugin(slug: string, update: PluginUpdate): Promise<void>
  
  // Analytics dashboard
  analytics: {
    downloads: TimeSeriesData
    activeInstalls: number
    revenue: RevenueData
    reviews: Review[]
    crashReports: CrashReport[]
  }
  
  // Revenue (70/30 split)
  revenue: {
    balance: number
    transactions: Transaction[]
    payout: PayoutMethod[]
    requestPayout(amount: number): Promise<void>
  }
  
  // Support
  support: {
    tickets: Ticket[]
    respond(ticketId: string, message: string): Promise<void>
  }
}
```

### 7.3 Plugin Categories

```typescript
enum PluginCategory {
  // Core functionality
  AUTHENTICATION = 'authentication',
  USER_MANAGEMENT = 'user-management',
  
  // Content
  CMS = 'cms',
  MEDIA = 'media',
  FORMS = 'forms',
  
  // E-commerce
  ECOMMERCE = 'ecommerce',
  PAYMENT = 'payment',
  SHIPPING = 'shipping',
  
  // Marketing
  SEO = 'seo',
  EMAIL_MARKETING = 'email-marketing',
  ANALYTICS = 'analytics',
  SOCIAL_MEDIA = 'social-media',
  
  // Business
  CRM = 'crm',
  ERP = 'erp',
  ACCOUNTING = 'accounting',
  INVOICING = 'invoicing',
  
  // Education
  LMS = 'lms',
  COURSES = 'courses',
  QUIZZES = 'quizzes',
  
  // Community
  FORUM = 'forum',
  SOCIAL_NETWORK = 'social-network',
  MEMBERSHIP = 'membership',
  MLM = 'mlm',
  
  // Integration
  API = 'api',
  WEBHOOK = 'webhook',
  THIRD_PARTY = 'third-party',
  
  // Utilities
  BACKUP = 'backup',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  DEVELOPMENT = 'development',
  
  // Themes
  THEME = 'theme',
}
```

---

## 8. Theme System Architecture

### 8.1 What Are Themes?

**Themes are special plugins** that focus primarily on frontend presentation and styling. They can:
- Override core components completely
- Provide custom layouts
- Define design systems
- Include custom widgets and components
- Work with any frontend framework (React, Vue, Svelte, etc.)

### 8.2 Theme Structure

```typescript
// Themes are plugins with `category: 'theme'`

# Theme development
fromcode theme create modern-business  # Create new theme
fromcode theme dev modern-business     # Preview theme with hot reload
fromcode theme build modern-business   # Build theme for production
fromcode theme publish modern-business # Publish to marketplace

plugins/modern-business-theme/
├── plugin.json              # Theme manifest (category: 'theme')
├── index.ts                 # Backend (optional - for theme settings)
│
├── frontend/                # Frontend implementation (REQUIRED)
│   ├── index.ts             # Theme entry point
│   ├── layouts/             # Page layouts
│   │   ├── Default.tsx
│   │   ├── Blog.tsx
│   │   └── ECommerce.tsx
│   ├── components/          # Shared components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Navigation.tsx
│   │   └── Sidebar.tsx
│   ├── overrides/           # Override ANY core/plugin component
│   │   ├── core/            # Override core framework components
│   │   │   ├── Header.tsx        # Override core Header
│   │   │   ├── Footer.tsx        # Override core Footer
│   │   │   └── Navigation.tsx    # Override core Navigation
│   │   ├── plugins/         # Override plugin components
│   │   │   ├── cms/
│   │   │   │   └── PostCard.tsx  # Override CMS plugin's PostCard
│   │   │   ├── seo/
│   │   │   │   └── SEOPreview.tsx # Override SEO plugin's preview
│   │   │   └── ecommerce/
│   │   │       └── ProductCard.tsx # Override product display
│   ├── widgets/             # Theme-specific widgets
│   │   ├── Newsletter.tsx
│   │   └── Testimonials.tsx
│   ├── styles/              # Styling
│   │   ├── theme.css        # Main theme styles
│   │   ├── variables.css    # CSS variables
│   │   └── typography.css
│   ├── lib/                 # Theme utilities
│   │   ├── theme-config.ts
│   │   └── color-schemes.ts
│   └── public/              # Theme assets
│       ├── fonts/
│       ├── images/
│       └── icons/
│
├── collections/             # Theme settings (optional)
│   └── ThemeSettings.ts     # Color schemes, fonts, etc.
│
└── README.md
```

### 8.3 Theme Manifest

```json
// plugins/my-theme/plugin.json
{
  "name": "Modern Business Theme",
  "slug": "modern-business",
  "version": "1.0.0",
  "category": "theme",
  "description": "A clean, modern theme for business websites",
  "author": "Your Name",
  "license": "MIT",
  
  // Theme-specific metadata
  "preview": "https://demo.example.com",
  "screenshots": [
    "/plugins/modern-business/screenshots/home.png",
    "/plugins/modern-business/screenshots/blog.png"
  ],
  
  // Framework compatibility
  "framework": "react",  // or "vue", "svelte", "preact"
  "frameworkVersion": "^18.0.0",
  
  // Theme features
  "features": [
    "responsive",
    "dark-mode",
    "rtl-support",
    "accessibility"
  ],
  
  // Color schemes
  "colorSchemes": ["light", "dark", "auto"],
  
  // Required plugins
  "dependencies": {
    "cms": "^1.0.0"  // Requires CMS plugin
  },
  
  "capabilities": [
    "admin:ui",
    "hooks"
  ]
}
```

### 8.4 Theme Frontend Entry Point

```typescript
// plugins/my-theme/frontend/index.ts

import { ThemeConfig } from '@fromcode/core'

// Component overrides - Theme can replace ANY component
export const overrides = {
  // Core framework components
  'core/components/Header': () => import('./overrides/core/Header'),
  'core/components/Footer': () => import('./overrides/core/Footer'),
  'core/components/Navigation': () => import('./overrides/core/Navigation'),
  
  // Core layouts
  'core/layouts/Default': () => import('./layouts/Default'),
  'core/layouts/Blog': () => import('./layouts/Blog'),
  
  // Override CMS plugin components
  'plugins/cms/components/PostCard': () => import('./overrides/plugins/cms/PostCard'),
  'plugins/cms/components/PostList': () => import('./overrides/plugins/cms/PostList'),
  'plugins/cms/components/PostMeta': () => import('./overrides/plugins/cms/PostMeta'),
  
  // Override SEO plugin components
  'plugins/seo/components/SEOPreview': () => import('./overrides/plugins/seo/SEOPreview'),
  
  // Override E-commerce plugin components
  'plugins/ecommerce/components/ProductCard': () => import('./overrides/plugins/ecommerce/ProductCard'),
  'plugins/ecommerce/components/CartWidget': () => import('./overrides/plugins/ecommerce/CartWidget'),
}

// Theme widgets
export const widgets = {
  Newsletter: () => import('./widgets/Newsletter'),
  Testimonials: () => import('./widgets/Testimonials'),
  CallToAction: () => import('./widgets/CallToAction'),
  HeroSection: () => import('./widgets/HeroSection'),
}

// Theme styles (served from plugin)
export const styles = [
  '/plugins/modern-business/frontend/styles/theme.css',
  '/plugins/modern-business/frontend/styles/variables.css',
]

// Theme configuration
export const config: ThemeConfig = {
  name: 'Modern Business',
  
  // Layout options
  layouts: {
    default: 'Default',
    blog: 'Blog',
    ecommerce: 'ECommerce',
  },
  
  // Color schemes
  colorSchemes: {
    light: {
      primary: '#2563eb',
      secondary: '#7c3aed',
      background: '#ffffff',
      text: '#1f2937',
    },
    dark: {
      primary: '#3b82f6',
      secondary: '#8b5cf6',
      background: '#1f2937',
      text: '#f9fafb',
    },
  },
  
  // Typography
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      serif: ['Merriweather', 'serif'],
      mono: ['Fira Code', 'monospace'],
    },
    fontSize: {
      base: '16px',
      scale: 1.25,  // Modular scale
    },
  },
  
  // Spacing system
  spacing: {
    unit: '8px',
    scale: [0, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32],
  },
}

// Theme initialization
export async function init() {
  console.log('[Theme] Modern Business initialized')
  
  // Apply theme variables to document
  applyThemeVariables(config)
  
  // Listen to theme settings changes
  window.fromcode.on('theme:settings:changed', (settings) => {
    applyColorScheme(settings.colorScheme)
  })
}

// Theme API
export const api = {
  setColorScheme: (scheme: 'light' | 'dark') => {
    applyColorScheme(scheme)
  },
  
  getConfig: () => config,
}
```

### 8.5 Theme Component Override Example

```typescript
// Example 1: Override core Header completely
// plugins/modern-business-theme/frontend/overrides/core/Header.tsx

import { Logo, Navigation } from '../../components'
import { Widget } from '@fromcode/core'

export default function Header() {
  return (
    <header className="theme-header">
      <div className="container">
        <div className="header-inner">
          <Logo />
          <Navigation />
          <div className="header-actions">
            <Widget plugin="search" name="SearchBar" />
            <Widget plugin="ecommerce" name="MiniCart" />
            <Widget plugin="users" name="UserMenu" />
          </div>
        </div>
      </div>
    </header>
  )
}

// Example 2: Extend SEO plugin component
// plugins/modern-business-theme/frontend/overrides/plugins/seo/SEOPreview.tsx

import { OriginalSEOPreview } from '@fromcode/plugins/seo/components/SEOPreview'

export default function SEOPreview({ post }) {
  return (
    <div className="theme-seo-preview">
      {/* Extend original component */}
      <OriginalSEOPreview post={post} />
      
      {/* Add theme-specific features */}
      <div className="theme-seo-score">
        <h4>SEO Score</h4>
        <div className="score-indicator">85/100</div>
      </div>
    </div>
  )
}

// Example 3: Completely replace CMS PostCard
// plugins/modern-business-theme/frontend/overrides/plugins/cms/PostCard.tsx

export default function PostCard({ post }) {
  // Completely custom design, ignoring original
  return (
    <article className="modern-post-card">
      <img src={post.image} alt={post.title} className="post-thumbnail" />
      <div className="post-content">
        <span className="post-category">{post.category}</span>
        <h3 className="post-title">{post.title}</h3>
        <p className="post-excerpt">{post.excerpt}</p>
        <a href={post.url} className="read-more">Read More →</a>
      </div>
    </article>
  )
}
```

### 8.6 Core Framework Components (Available for Override)

The core framework provides these components that themes can override:

```typescript
// Core components available for override
export const CORE_COMPONENTS = {
  // Layout components
  'core/layouts/Default': 'Default page layout',
  'core/layouts/Blank': 'Blank layout (no header/footer)',
  'core/layouts/Admin': 'Admin panel layout',
  
  // Navigation
  'core/components/Header': 'Site header',
  'core/components/Footer': 'Site footer',
  'core/components/Navigation': 'Main navigation menu',
  'core/components/Breadcrumbs': 'Breadcrumb navigation',
  
  // UI elements
  'core/components/Button': 'Button component',
  'core/components/Input': 'Input field',
  'core/components/Card': 'Card container',
  'core/components/Modal': 'Modal dialog',
  'core/components/Toast': 'Toast notification',
  
  // Pages
  'core/pages/Home': 'Homepage template',
  'core/pages/NotFound': '404 page',
  'core/pages/Error': 'Error page',
  
  // Forms
  'core/components/Form': 'Form wrapper',
  'core/components/FormField': 'Form field wrapper',
  
  // Loading states
  'core/components/Spinner': 'Loading spinner',
  'core/components/Skeleton': 'Skeleton loader',
}

// Plugins also expose components that can be overridden
// Example: CMS plugin
export const CMS_PLUGIN_COMPONENTS = {
  'plugins/cms/components/PostCard': 'Blog post card',
  'plugins/cms/components/PostList': 'List of posts',
  'plugins/cms/components/PostMeta': 'Post metadata display',
  'plugins/cms/components/PostContent': 'Post content renderer',
  'plugins/cms/components/CategoryList': 'Category list',
}

// Any plugin can declare overridable components
// in their frontend/index.ts:
export const overridableComponents = {
  'PostCard': './components/PostCard',
  'PostList': './components/PostList',
  // Theme can override: 'plugins/cms/components/PostCard'
}
```

### 8.7 Multi-Framework Support

Fromcode Hub supports themes built with different frontend frameworks:

```typescript
// React Theme (Default)
// plugins/react-theme/plugin.json
{
  "framework": "react",
  "frameworkVersion": "^18.0.0"
}

// Vue Theme
// plugins/vue-theme/plugin.json
{
  "framework": "vue",
  "frameworkVersion": "^3.0.0"
}

// Svelte Theme
// plugins/svelte-theme/plugin.json
{
  "framework": "svelte",
  "frameworkVersion": "^4.0.0"
}

// Pure CSS Theme (No JS framework)
// plugins/css-theme/plugin.json
{
  "framework": "none",
  "description": "Pure CSS theme, works with any framework"
}
```

#### Framework-Specific Implementation

```typescript
// Core adapter system handles different frameworks

// For React themes (default)
const ReactThemeAdapter = {
  load: async (theme: Theme) => {
    const module = await import(`/plugins/${theme.slug}/frontend`)
    return {
      overrides: module.overrides,
      widgets: module.widgets,
    }
  },
  
  render: (Component: ReactComponent, props: any) => {
    return <Component {...props} />
  },
}

// For Vue themes
const VueThemeAdapter = {
  load: async (theme: Theme) => {
    const module = await import(`/plugins/${theme.slug}/frontend`)
    return {
      overrides: module.overrides,
      widgets: module.widgets,
    }
  },
  
  render: (Component: VueComponent, props: any) => {
    return h(Component, props)
  },
}

// For CSS-only themes
const CSSThemeAdapter = {
  load: async (theme: Theme) => {
    // Just load CSS, no JS needed
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `/plugins/${theme.slug}/frontend/theme.css`
    document.head.appendChild(link)
  },
}
```

### 8.8 Theme Settings & Customization

```typescript
// Backend: Theme settings collection
// plugins/my-theme/collections/ThemeSettings.ts

export const ThemeSettings = {
  slug: 'theme-settings',
  admin: {
    group: 'Theme',
  },
  fields: [
    {
      name: 'colorScheme',
      type: 'select',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'light',
    },
    {
      name: 'primaryColor',
      type: 'color',
      defaultValue: '#2563eb',
    },
    {
      name: 'fontFamily',
      type: 'select',
      options: [
        { label: 'Inter', value: 'inter' },
        { label: 'Roboto', value: 'roboto' },
        { label: 'Open Sans', value: 'open-sans' },
      ],
    },
    {
      name: 'headerLayout',
      type: 'select',
      options: [
        { label: 'Center', value: 'center' },
        { label: 'Left', value: 'left' },
        { label: 'Right', value: 'right' },
      ],
    },
    {
      name: 'enableAnimations',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
```

### 8.9 Using Themes

```bash
# List available themes
$ fromcode themes list

# Install theme from marketplace
$ fromcode themes install modern-business

# Activate theme
$ fromcode themes activate modern-business

# Theme automatically:
# ✓ Overrides core components
# ✓ Applies styles
# ✓ Registers widgets
# ✓ Sets up layouts

# Customize theme settings
$ fromcode themes configure modern-business

# Preview theme before activation
$ fromcode themes preview modern-business
```

### 8.10 Theme vs Plugin

| Feature | Plugin | Theme |
|---------|--------|-------|
| **Primary Focus** | Functionality | Presentation |
| **Backend Logic** | Usually required | Optional |
| **Frontend** | Optional | Required |
| **Component Overrides** | Can override | Heavily uses overrides |
| **Can be combined** | Multiple plugins active | One theme active |
| **Styling** | Plugin-specific | Site-wide |
| **Examples** | SEO, E-commerce, Forms | Modern Business, Blog Theme |

### 8.11 Creating Custom Themes

```bash
# Create new theme
$ fromcode theme create my-awesome-theme

? Theme name: My Awesome Theme
? Description: A beautiful theme for...
? Framework: React
? Color schemes: light, dark
? Features: responsive, dark-mode, rtl-support

✓ Created theme scaffold
✓ Generated layouts
✓ Created component overrides
✓ Set up theme settings
✓ Added example widgets

Next steps:
  cd plugins/my-awesome-theme
  fromcode theme dev  # Preview theme in development
```

### 8.12 Theme Best Practices

```typescript
// 1. Use CSS Variables for Customization
// plugins/my-theme/frontend/styles/variables.css
:root {
  --theme-primary: #2563eb;
  --theme-secondary: #7c3aed;
  --theme-background: #ffffff;
  --theme-text: #1f2937;
  --theme-spacing-unit: 8px;
}

[data-theme="dark"] {
  --theme-background: #1f2937;
  --theme-text: #f9fafb;
}

// 2. Respect Plugin Components
// Don't break plugin functionality when overriding
export default function CustomPostCard({ post }) {
  // Call original logic if needed
  const { title, excerpt, image } = post
  
  return (
    <article className="theme-post-card">
      {/* Your custom design */}
      <img src={image} alt={title} />
      <h3>{title}</h3>
      <p>{excerpt}</p>
      
      {/* Keep plugin slots for extensibility */}
      <Slot name="post.card.actions" props={{ post }} />
    </article>
  )
}

// 3. Provide Fallbacks
export const overrides = {
  'core/components/Header': () => import('./overrides/Header')
    .catch(() => import('@fromcode/core/components/Header')),
}

// 4. Document Customization
// Include detailed README with:
// - Supported plugins
// - Customization options
// - Code examples
// - Demo site link
```

### 37. Frontend Navigation Management

Fromcode provides a built-in system for managing frontend navigation menus (Header, Footer, Sidebar, etc.) through the Admin UI. This data is managed by the CMS plugin and consumed by themes via the CMS UI plugin.

#### 37.1 Navigation Hook (useMenu)

Themes can fetch menu data dynamically using the `useMenu(slug)` hook from the CMS plugin.

```typescript
import { useMenu } from '@fromcode-plugin/cms-ui';

function Header() {
  const { menu, loading, error } = useMenu('header');

  if (loading) return <Spinner />;
  if (error) return null;
  if (!menu) return null;

  return (
    <nav>
      {menu.items.map(item => (
        <a 
          key={item.path} 
          href={item.path}
          target={item.target}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
```

#### 37.2 Data Structure

The `Navigation` collection in the CMS plugin defines the structure for these menus:

```typescript
interface NavigationMenu {
  name: string;      // Human readable name (e.g., "Main Header")
  slug: string;      // Unique identifier (e.g., "header")
  items: {
    label: string;   // Display text
    url: string;     // Target URL
    target: string;  // _self or _blank
    priority: number; // For sorting
  }[];
}
```

The `useMenu` hook returns `menu` as an array of items already sorted by priority.

---

## 8.13 Theme Marketplace Categories

Themes in the marketplace are organized by:

- **Business**: Corporate, Agency, Startup
- **Blog**: Magazine, Personal Blog, News
- **E-commerce**: Shop, Marketplace, Products
- **Portfolio**: Creative, Photography, Designer
- **Education**: LMS, Courses, University
- **Community**: Forum, Social Network, Membership
- **Landing**: SaaS, App Landing, Product Launch
- **Minimal**: Clean, Simple, Text-focused

---

## 9. Plugin Security & Isolation

### 9.1 Plugin Sandbox Architecture

Each plugin runs in complete isolation to prevent cross-plugin attacks:

```typescript
// Multi-layer security isolation
interface PluginIsolation {
  // 1. Process Isolation (highest security)
  processIsolation: {
    // Each plugin in separate Node.js worker thread
    workerThread: true
    
    // Resource limits per plugin
    limits: {
      memory: '512MB',      // Max memory per plugin
      cpu: '1 core',        // CPU allocation
      diskIO: '100MB/s',    // Disk I/O limit
      networkCalls: 100,    // Requests per minute
    }
    
    // Kill plugin if it misbehaves
    timeout: 30000,         // 30s max execution time
    crashRecovery: true,    // Auto-restart on crash
  }
  
  // 2. Database Isolation
  databaseIsolation: {
    // Plugins can only access their own tables
    schemaPrefix: true,     // All tables prefixed with plugin slug
    rowLevelSecurity: true, // PostgreSQL RLS
    
    // Example: 'seo_' prefix for SEO plugin
    // Tables: seo_settings, seo_redirects, seo_analytics
    
    // Cross-plugin queries blocked by default
    crossPluginAccess: false,
    
    // Plugins must use API to read other plugin data
    apiOnly: true,
  }
  
  // 3. File System Isolation
  fileSystemIsolation: {
    // Each plugin has its own directory
    pluginDirectory: '/plugins/{slug}/data/',
    
    // Cannot access other plugin directories
    jailRoot: true,
    
    // Whitelist allowed paths
    allowedPaths: [
      '/plugins/{slug}/',       // Own plugin dir
      '/public/plugins/{slug}/', // Public assets
      '/tmp/plugins/{slug}/',   // Temp files
    ],
    
    // Block access to:
    blockedPaths: [
      '/plugins/*/',            // Other plugins
      '/backend/',              // Core backend
      '/node_modules/',         // Dependencies
      '/.env',                  // Environment vars
    ],
  }
  
  // 4. Network Isolation
  networkIsolation: {
    // Whitelist allowed domains
    allowedDomains: [],       // Declared in manifest
    
    // Block internal network
    blockPrivateIPs: true,    // No 192.168.x.x, 10.x.x.x
    blockLocalhost: true,     // No localhost access
    
    // Rate limiting
    rateLimit: {
      requests: 100,          // Per minute
      bandwidth: '10MB',      // Per minute
    },
  }
  
  // 5. Code Execution Isolation
  codeIsolation: {
    // No eval() or Function() constructor
    disableEval: true,
    
    // No access to process, require, etc.
    disableNodeAPIs: [
      'process',
      'child_process',
      'fs',
      'net',
      'dgram',
      'cluster',
    ],
    
    // Whitelist safe APIs
    allowedAPIs: [
      'console',
      'setTimeout',
      'setInterval',
      'Promise',
      'fetch',              // Sandboxed fetch
    ],
  }
}
```

### 9.2 Inter-Plugin Communication Security

```typescript
// Plugins communicate through secure API only
interface SecurePluginAPI {
  // 1. Explicit API declaration
  // Plugin must declare what it exposes
  // plugins/cms/index.ts
  publicAPI: {
    // Only these methods are callable
    createPost: async (data: PostData) => { /* ... */ },
    getPosts: async (query: Query) => { /* ... */ },
    
    // Internal methods NOT exposed
    _internalMethod: () => { /* ... */ },  // Not accessible
  },
  
  // 2. Permission checks on every call
  async callPlugin(targetPlugin: string, method: string, args: any[]) {
    // Check if caller has permission
    if (!this.hasPermission(callerPlugin, targetPlugin, method)) {
      throw new Error('Permission denied')
    }
    
    // Check if method is public
    if (!targetPlugin.publicAPI[method]) {
      throw new Error('Method not exposed')
    }
    
    // Validate arguments (prevent injection)
    const validatedArgs = this.validateArgs(method, args)
    
    // Execute in isolated context
    return await this.executeSecure(targetPlugin, method, validatedArgs)
  },
  
  // 3. Data sanitization
  validateArgs(method: string, args: any[]) {
    // Strip dangerous properties
    return sanitize(args, {
      stripScripts: true,
      stripSQL: true,
      stripHTML: true,
    })
  },
}
```

### 9.3 Plugin Code Signing & Verification

```typescript
// All plugins must be signed
interface PluginSignature {
  // 1. Developer signs plugin with private key
  signPlugin: async (plugin: PluginPackage) => {
    const hash = crypto.createHash('sha256')
      .update(plugin.code)
      .digest('hex')
    
    const signature = await crypto.sign(
      hash,
      developerPrivateKey
    )
    
    return {
      hash,
      signature,
      publicKey: developerPublicKey,
      timestamp: Date.now(),
    }
  },
  
  // 2. Framework verifies before loading
  verifyPlugin: async (plugin: PluginPackage) => {
    // Verify signature
    const signatureValid = await crypto.verify(
      plugin.signature,
      plugin.publicKey,
      plugin.hash
    )
    
    if (!signatureValid) {
      throw new Error('Invalid plugin signature')
    }
    
    // Verify hash matches actual code
    const actualHash = crypto.createHash('sha256')
      .update(plugin.code)
      .digest('hex')
    
    if (actualHash !== plugin.hash) {
      throw new Error('Plugin code has been modified')
    }
    
    // Check if developer is trusted
    const developerTrusted = await this.isDeveloperTrusted(
      plugin.publicKey
    )
    
    if (!developerTrusted && !userApproved) {
      throw new Error('Untrusted developer')
    }
    
    return true
  },
}
```

### 9.4 Runtime Security Monitoring

```typescript
// Monitor plugin behavior in real-time
interface SecurityMonitor {
  // 1. Track plugin activity
  trackActivity: {
    databaseQueries: number,
    networkRequests: number,
    fileOperations: number,
    memoryUsage: number,
    cpuUsage: number,
  },
  
  // 2. Anomaly detection
  detectAnomalies: async () => {
    // Detect suspicious patterns
    if (plugin.databaseQueries > THRESHOLD) {
      await this.alertAdmin('Excessive DB queries', plugin)
    }
    
    if (plugin.networkRequests > THRESHOLD) {
      await this.alertAdmin('Excessive network calls', plugin)
    }
    
    // Detect injection attempts
    if (this.detectSQLInjection(plugin.queries)) {
      await this.disablePlugin(plugin, 'SQL injection attempt')
    }
  },
  
  // 3. Automatic plugin suspension
  suspendPlugin: async (plugin: Plugin, reason: string) => {
    // Stop plugin immediately
    await pluginLoader.unload(plugin.slug)
    
    // Log incident
    await logger.security('Plugin suspended', {
      plugin: plugin.slug,
      reason,
      timestamp: Date.now(),
    })
    
    // Notify admin
    await notifyAdmin({
      severity: 'critical',
      message: `Plugin ${plugin.name} suspended: ${reason}`,
    })
  },
}
```

### 9.5 Security Best Practices for Plugin Developers

```typescript
// Example: Secure plugin development

// ✅ GOOD: Use provided APIs
export const securePlugin: FromcodePlugin = () => ({
  name: 'secure-plugin',
  
  async onEnable(ctx) {
    // Use sandboxed database API
    const data = await ctx.db.find('my-collection', {})
    
    // Use sandboxed fetch
    const response = await ctx.fetch('https://api.example.com/data')
    
    // Use plugin communication API
    const cms = ctx.plugins.getAPI('cms')
    await cms.createPost({ title: 'Hello' })
  },
})

// ❌ BAD: Direct access (blocked by sandbox)
export const insecurePlugin: FromcodePlugin = () => ({
  name: 'insecure-plugin',
  
  async onEnable(ctx) {
    // ❌ Blocked: Direct DB access
    const db = require('pg')
    
    // ❌ Blocked: File system access
    const fs = require('fs')
    fs.readFileSync('/etc/passwd')
    
    // ❌ Blocked: Process access
    process.exit(1)
    
    // ❌ Blocked: Child processes
    require('child_process').exec('rm -rf /')
  },
})
```

---

## 10. Localization & Internationalization (i18n)

### 10.1 Core i18n Architecture

```typescript
// Built-in i18n plugin (part of core)
// plugins/i18n/index.ts

export const i18nPlugin: FromcodePlugin = () => ({
  name: 'i18n',
  category: 'core',
  
  collections: [
    {
      slug: 'locales',
      fields: [
        { name: 'code', type: 'text' },      // en, es, bg, etc.
        { name: 'name', type: 'text' },      // English, Español, etc.
        { name: 'direction', type: 'select', options: ['ltr', 'rtl'] },
        { name: 'enabled', type: 'checkbox' },
        { name: 'default', type: 'checkbox' },
      ],
    },
    {
      slug: 'translations',
      fields: [
        { name: 'key', type: 'text' },       // user.login.button
        { name: 'locale', type: 'relationship', relationTo: 'locales' },
        { name: 'value', type: 'text' },     // Translated text
        { name: 'plugin', type: 'text' },    // Which plugin owns this
      ],
    },
  ],
  
  // Extend all collections with locale field
  hooks: [
    {
      collection: '*',
      hook: 'beforeCreate',
      handler: async (doc, ctx) => {
        // Add locale to document
        return {
          ...doc,
          locale: ctx.locale || 'en',
        }
      },
    },
  ],
  
  // Provide i18n API
  publicAPI: {
    t: (key: string, locale?: string) => getTranslation(key, locale),
    setLocale: (locale: string) => setCurrentLocale(locale),
    getLocale: () => getCurrentLocale(),
    getSupportedLocales: () => getSupportedLocales(),
  },
})
```

### 10.2 Plugin Localization

```typescript
// Each plugin provides its own translations
// plugins/seo/i18n/en.json
{
  "seo.title": "SEO Settings",
  "seo.description": "Manage your site's SEO",
  "seo.metaTitle": "Meta Title",
  "seo.metaDescription": "Meta Description",
  "seo.preview": "Google Preview"
}

// plugins/seo/i18n/bg.json
{
  "seo.title": "SEO Настройки",
  "seo.description": "Управление на SEO на вашия сайт",
  "seo.metaTitle": "Мета Заглавие",
  "seo.metaDescription": "Мета Описание",
  "seo.preview": "Google Преглед"
}

// Usage in plugin
// plugins/seo/frontend/components/SEOPreview.tsx
import { useTranslation } from '@fromcode/hooks'

export default function SEOPreview({ post }) {
  const { t } = useTranslation('seo')
  
  return (
    <div>
      <h3>{t('seo.preview')}</h3>
      <input placeholder={t('seo.metaTitle')} />
      <textarea placeholder={t('seo.metaDescription')} />
    </div>
  )
}
```

### 10.3 Content Localization

```typescript
// Collections support multiple locales
interface LocalizedCollection {
  slug: 'posts',
  localization: {
    enabled: true,
    
    // Localization strategy
    strategy: 'duplicate' | 'field',
    
    // duplicate: Separate documents per locale
    // posts_en, posts_es, posts_bg
    
    // field: Single document with locale fields
    // { title_en, title_es, title_bg }
  },
  
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,  // Creates title_en, title_es, etc.
    },
    {
      name: 'content',
      type: 'richText',
      localized: true,
    },
  ],
}

// API automatically handles locale
GET /api/v1/posts?locale=bg  // Returns Bulgarian posts
GET /api/v1/posts?locale=en  // Returns English posts
```

---

## 11. Multi-Tenancy & Multi-Store Architecture

### 11.1 Tenant Isolation

```typescript
// Core multi-tenancy support
interface TenantArchitecture {
  // 1. Database isolation strategies
  databaseStrategy: 'shared' | 'schema' | 'database',
  
  // Shared: Single database, tenant_id column
  shared: {
    // All tables have tenant_id
    // SELECT * FROM posts WHERE tenant_id = 'tenant-123'
    pros: ['Cost effective', 'Easy to manage'],
    cons: ['Less isolated', 'Potential data leaks'],
  },
  
  // Schema: One schema per tenant
  schema: {
    // tenant_123.posts, tenant_456.posts
    // PostgreSQL schemas, MySQL databases
    pros: ['Good isolation', 'Reasonable cost'],
    cons: ['More complex migrations'],
  },
  
  // Database: Separate database per tenant
  database: {
    // tenant_123_db, tenant_456_db
    pros: ['Complete isolation', 'Best security'],
    cons: ['Expensive', 'Complex management'],
  },
}

// Implementation
interface Tenant {
  id: string
  slug: string              // acme-corp
  name: string              // Acme Corporation
  
  // Database config
  database: {
    strategy: 'schema',
    schemaName: 'tenant_acme_corp',
  },
  
  // Domain config
  domains: [
    'acme.example.com',     // Primary domain
    'acmecorp.com',         // Custom domain
  ],
  
  // Feature flags
  features: {
    multiStore: true,       // Enable multi-store
    multiLocale: true,      // Enable multiple languages
  },
  
  // Plugin config per tenant
  plugins: {
    enabled: ['cms', 'ecommerce', 'seo'],
    config: {
      ecommerce: {
        currency: 'USD',
        taxRate: 0.10,
      },
    },
  },
  
  // Limits
  limits: {
    users: 100,
    storage: '10GB',
    apiCalls: 100000,
  },
}
```

### 11.2 Multi-Store Architecture

```typescript
// E-commerce multi-store support
interface MultiStore {
  // Each tenant can have multiple stores
  tenant: 'acme-corp',
  
  stores: [
    {
      id: 'store-us',
      name: 'Acme US',
      domain: 'us.acme.com',
      locale: 'en-US',
      currency: 'USD',
      warehouse: 'warehouse-us',
      taxRate: 0.08,
    },
    {
      id: 'store-eu',
      name: 'Acme EU',
      domain: 'eu.acme.com',
      locale: 'en-GB',
      currency: 'EUR',
      warehouse: 'warehouse-eu',
      taxRate: 0.20,
    },
    {
      id: 'store-bg',
      name: 'Acme Bulgaria',
      domain: 'bg.acme.com',
      locale: 'bg',
      currency: 'BGN',
      warehouse: 'warehouse-eu',
      taxRate: 0.20,
    },
  ],
  
  // Shared data across stores
  shared: {
    products: true,         // Same product catalog
    customers: false,       // Separate customers
    inventory: false,       // Separate inventory
  },
}

// Middleware detects store from domain
export async function tenantMiddleware(req, res, next) {
  // 1. Extract tenant from domain
  const domain = req.hostname  // us.acme.com
  const tenant = await getTenantByDomain(domain)
  
  if (!tenant) {
    return res.status(404).send('Tenant not found')
  }
  
  // 2. Find store
  const store = tenant.stores.find(s => s.domain === domain)
  
  // 3. Set context
  req.tenant = tenant
  req.store = store
  req.locale = store.locale
  req.currency = store.currency
  
  // 4. Switch database schema
  await switchTenantSchema(tenant.database.schemaName)
  
  next()
}
```

### 11.3 Tenant-Aware Plugins

```typescript
// Plugins automatically work with multi-tenancy
export const ecommercePlugin: FromcodePlugin = () => ({
  name: 'ecommerce',
  
  async onEnable(ctx) {
    // ctx.tenant is automatically available
    console.log('Enabled for tenant:', ctx.tenant.name)
    
    // ctx.store is available in multi-store setup
    if (ctx.store) {
      console.log('Store:', ctx.store.name)
    }
  },
  
  endpoints: [
    {
      path: '/products',
      method: 'get',
      handler: async (req, res) => {
        // Automatically scoped to tenant
        const products = await req.payload.find({
          collection: 'products',
          // tenant_id automatically added to query
        })
        
        // Filter by store if multi-store
        if (req.store) {
          products = products.filter(p => 
            p.stores.includes(req.store.id)
          )
        }
        
        res.json(products)
      },
    },
  ],
})
```

---

## 12. Deployment Architecture

### 12.1 Docker Deployment Modes

```dockerfile
# Dockerfile with multiple modes
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application
COPY . .

# Build
RUN npm run build

# ===================================
# MODE 1: API Only
# ===================================
FROM base AS api-only
EXPOSE 3000
ENV DEPLOYMENT_MODE=api
CMD ["npm", "run", "start:api"]

# ===================================
# MODE 2: API + Admin Backend
# ===================================
FROM base AS api-admin
EXPOSE 3000 3001
ENV DEPLOYMENT_MODE=api-admin
CMD ["npm", "run", "start:api-admin"]

# ===================================
# MODE 3: Full Stack (API + Admin + Frontend)
# ===================================
FROM base AS full-stack
EXPOSE 3000 3001 3002
ENV DEPLOYMENT_MODE=full
CMD ["npm", "run", "start:all"]

# ===================================
# MODE 4: Frontend Only (Edge deployment)
# ===================================
FROM base AS frontend-only
EXPOSE 3002
ENV DEPLOYMENT_MODE=frontend
ENV API_URL=https://api.example.com
CMD ["npm", "run", "start:frontend"]
```

### 12.2 Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ===================
  # API Service
  # ===================
  api:
    build:
      context: .
      target: api-only
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/fromcode
      - REDIS_URL=redis://redis:6379
      - NODE_ENV=production
    depends_on:
      - db
      - redis
    restart: unless-stopped
    deploy:
      replicas: 3  # Scale API horizontally
      resources:
        limits:
          cpus: '1'
          memory: 1G

  # ===================
  # Admin Backend Service
  # ===================
  admin:
    build:
      context: .
      target: api-admin
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/fromcode
      - REDIS_URL=redis://redis:6379
      - API_URL=http://api:3000
    depends_on:
      - db
      - redis
      - api
    restart: unless-stopped

  # ===================
  # Frontend Service
  # ===================
  frontend:
    build:
      context: .
      target: frontend-only
    ports:
      - "3002:3002"
    environment:
      - API_URL=http://api:3000
      - ADMIN_URL=http://admin:3001
    depends_on:
      - api
    restart: unless-stopped
    deploy:
      replicas: 2

  # ===================
  # Database
  # ===================
  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=fromcode
      - POSTGRES_USER=fromcode
      - POSTGRES_PASSWORD=secure_password
    restart: unless-stopped

  # ===================
  # Redis Cache
  # ===================
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  # ===================
  # Load Balancer
  # ===================
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api
      - admin
      - frontend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 12.3 Deployment Mode Configuration

```typescript
// packages/core/deployment-config.ts

interface DeploymentMode {
  mode: 'api' | 'api-admin' | 'full' | 'frontend'
  
  services: {
    api: boolean
    admin: boolean
    frontend: boolean
  }
}

const DEPLOYMENT_MODES: Record<string, DeploymentMode> = {
  // API only - for headless CMS, mobile apps
  api: {
    mode: 'api',
    services: {
      api: true,
      admin: false,
      frontend: false,
    },
  },
  
  // API + Admin - for content management
  'api-admin': {
    mode: 'api-admin',
    services: {
      api: true,
      admin: true,
      frontend: false,
    },
  },
  
  // Full stack - everything in one
  full: {
    mode: 'full',
    services: {
      api: true,
      admin: true,
      frontend: true,
    },
  },
  
  // Frontend only - connect to external API
  frontend: {
    mode: 'frontend',
    services: {
      api: false,
      admin: false,
      frontend: true,
    },
  },
}

// Start services based on mode
export async function startServices() {
  const mode = process.env.DEPLOYMENT_MODE || 'full'
  const config = DEPLOYMENT_MODES[mode]
  
  console.log(`🚀 Starting in ${mode} mode`)
  
  if (config.services.api) {
    await startAPIServer()
    console.log('✓ API Server running on port 3000')
  }
  
  if (config.services.admin) {
    await startAdminServer()
    console.log('✓ Admin Server running on port 3001')
  }
  
  if (config.services.frontend) {
    await startFrontendServer()
    console.log('✓ Frontend Server running on port 3002')
  }
}
```

### 12.4 CLI Deployment Commands

```bash
# Build for specific mode
fromcode build --mode=api-only
fromcode build --mode=api-admin
fromcode build --mode=full-stack
fromcode build --mode=frontend-only

# Docker deployment
fromcode docker:build --mode=api-only
fromcode docker:deploy --mode=api-admin

# Start in development
fromcode dev --api              # API only
fromcode dev --admin            # Admin only
fromcode dev --frontend         # Frontend only
fromcode dev --all              # All services

# Production start
fromcode start --mode=api
fromcode start --mode=full
```

---

## 13. Infrastructure & Configuration

### 13.1 Database Configuration

```typescript
// Flexible database selection per deployment
interface DatabaseConfig {
  // Choose database type
  type: 'postgres' | 'mysql' | 'sqlite' | 'mongodb',
  
  // Connection configuration
  connection: {
    host: string,
    port: number,
    database: string,
    username: string,
    password: string,
    ssl?: boolean,
  },
  
  // Connection pool
  pool: {
    min: number,
    max: number,
    idleTimeout: number,
  },
  
  // Multi-tenancy database strategy
  multiTenancy?: {
    enabled: boolean,
    strategy: 'shared' | 'schema' | 'database',
    schemaPrefix?: string,
  },
  
  // Replication (for scale)
  replication?: {
    enabled: boolean,
    read: string[],        // Read replica URLs
    write: string,         // Primary write URL
  },
}

// Example configurations
const DATABASE_CONFIGS = {
  // Development: SQLite for simplicity
  development: {
    type: 'sqlite',
    connection: {
      filename: './dev.db',
    },
  },
  
  // Production: PostgreSQL with replication
  production: {
    type: 'postgres',
    connection: {
      host: process.env.DB_HOST,
      port: 5432,
      database: 'fromcode_prod',
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: true,
    },
    pool: {
      min: 2,
      max: 20,
      idleTimeout: 30000,
    },
    replication: {
      enabled: true,
      read: [
        'postgres://read-1.example.com',
        'postgres://read-2.example.com',
      ],
      write: 'postgres://primary.example.com',
    },
  },
}
```

### 13.2 Cache & Redis Configuration

```typescript
// Flexible caching system
interface CacheConfig {
  // Cache driver
  driver: 'redis' | 'memory' | 'memcached' | 'none',
  
  // Redis configuration
  redis?: {
    host: string,
    port: number,
    password?: string,
    db: number,
    
    // Redis Cluster
    cluster?: {
      enabled: boolean,
      nodes: string[],
    },
    
    // Redis Sentinel (high availability)
    sentinel?: {
      enabled: boolean,
      masterName: string,
      sentinels: Array<{ host: string, port: number }>,
    },
  },
  
  // Memory cache (for development)
  memory?: {
    maxSize: number,        // MB
    ttl: number,           // Default TTL in seconds
  },
  
  // Cache prefix (for multi-tenant)
  prefix?: string,
  
  // Default TTL
  defaultTTL: number,
}

// Example: Development vs Production
const CACHE_CONFIGS = {
  development: {
    driver: 'memory',
    memory: {
      maxSize: 100,        // 100MB
      ttl: 3600,          // 1 hour
    },
  },
  
  production: {
    driver: 'redis',
    redis: {
      host: process.env.REDIS_HOST,
      port: 6379,
      password: process.env.REDIS_PASSWORD,
      db: 0,
      cluster: {
        enabled: true,
        nodes: [
          'redis-1.example.com:6379',
          'redis-2.example.com:6379',
          'redis-3.example.com:6379',
        ],
      },
    },
    defaultTTL: 3600,
  },
}
```

### 13.3 Email Service Configuration

```typescript
// Flexible email service
interface EmailConfig {
  // Email provider
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses' | 'postmark',
  
  // From address
  from: {
    name: string,
    email: string,
  },
  
  // SMTP configuration
  smtp?: {
    host: string,
    port: number,
    secure: boolean,
    auth: {
      user: string,
      pass: string,
    },
  },
  
  // SendGrid
  sendgrid?: {
    apiKey: string,
    sandbox: boolean,    // Test mode
  },
  
  // Mailgun
  mailgun?: {
    apiKey: string,
    domain: string,
    region: 'us' | 'eu',
  },
  
  // AWS SES
  ses?: {
    accessKeyId: string,
    secretAccessKey: string,
    region: string,
  },
  
  // Email templates
  templates?: {
    path: string,        // Path to email templates
    engine: 'handlebars' | 'ejs' | 'pug',
  },
}

// Example configurations
const EMAIL_CONFIGS = {
  development: {
    provider: 'smtp',
    from: {
      name: 'Fromcode Dev',
      email: 'dev@localhost',
    },
    smtp: {
      host: 'localhost',
      port: 1025,        // MailHog for testing
      secure: false,
      auth: {
        user: '',
        pass: '',
      },
    },
  },
  
  production: {
    provider: 'sendgrid',
    from: {
      name: 'Fromcode',
      email: 'noreply@fromcode.com',
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      sandbox: false,
    },
    templates: {
      path: './email-templates',
      engine: 'handlebars',
    },
  },
}
```

### 13.4 Storage Configuration

```typescript
// Flexible file storage
interface StorageConfig {
  // Storage driver
  driver: 'local' | 's3' | 'r2' | 'gcs' | 'azure',
  
  // Local storage
  local?: {
    path: string,
    publicUrl: string,
  },
  
  // AWS S3
  s3?: {
    bucket: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    endpoint?: string,   // For S3-compatible services
  },
  
  // Cloudflare R2
  r2?: {
    accountId: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucket: string,
    publicUrl: string,
  },
  
  // Google Cloud Storage
  gcs?: {
    bucket: string,
    projectId: string,
    keyFilename: string,
  },
  
  // Azure Blob Storage
  azure?: {
    account: string,
    accountKey: string,
    container: string,
  },
}

// Example configurations
const STORAGE_CONFIGS = {
  development: {
    driver: 'local',
    local: {
      path: './uploads',
      publicUrl: 'http://localhost:3000/uploads',
    },
  },
  
  production: {
    driver: 'r2',        // Cloudflare R2 (cheaper than S3)
    r2: {
      accountId: process.env.R2_ACCOUNT_ID,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      bucket: 'fromcode-prod',
      publicUrl: 'https://cdn.fromcode.com',
    },
  },
}
```

### 13.5 Queue System Configuration

```typescript
// Background job processing
interface QueueConfig {
  // Queue driver
  driver: 'redis' | 'sqs' | 'rabbitmq' | 'sync',
  
  // Redis-based queue (BullMQ)
  redis?: {
    host: string,
    port: number,
    password?: string,
    db: number,
  },
  
  // AWS SQS
  sqs?: {
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    queueUrl: string,
  },
  
  // RabbitMQ
  rabbitmq?: {
    url: string,
    exchange: string,
  },
  
  // Queue configuration
  queues: {
    [queueName: string]: {
      concurrency: number,   // Concurrent jobs
      rateLimit?: {
        max: number,         // Max jobs per duration
        duration: number,    // Duration in ms
      },
    },
  },
}

// Example: Email queue
const QUEUE_CONFIG = {
  driver: 'redis',
  redis: {
    host: process.env.REDIS_HOST,
    port: 6379,
  },
  queues: {
    email: {
      concurrency: 5,
      rateLimit: {
        max: 100,          // 100 emails
        duration: 60000,   // per minute
      },
    },
    'image-processing': {
      concurrency: 2,
    },
    webhooks: {
      concurrency: 10,
    },
  },
}
```

### 13.6 Logging Configuration

```typescript
// Centralized logging
interface LoggingConfig {
  // Log level
  level: 'debug' | 'info' | 'warn' | 'error',
  
  // Log destinations
  transports: Array<{
    type: 'console' | 'file' | 'syslog' | 'cloudwatch' | 'datadog',
    
    // Console
    console?: {
      colorize: boolean,
    },
    
    // File
    file?: {
      filename: string,
      maxSize: number,     // MB
      maxFiles: number,
      compress: boolean,
    },
    
    // AWS CloudWatch
    cloudwatch?: {
      logGroupName: string,
      logStreamName: string,
      region: string,
    },
    
    // Datadog
    datadog?: {
      apiKey: string,
      service: string,
    },
  }>,
  
  // Structured logging
  format: 'json' | 'text',
  
  // Include context
  includeContext: {
    timestamp: boolean,
    hostname: boolean,
    pid: boolean,
    level: boolean,
  },
}
```

### 13.7 Environment Management

```typescript
// .env file structure
interface EnvironmentVariables {
  // Core
  NODE_ENV: 'development' | 'production' | 'test',
  PORT: number,
  HOST: string,
  
  // Database
  DATABASE_URL: string,
  DB_TYPE: 'postgres' | 'mysql' | 'sqlite',
  
  // Redis
  REDIS_URL?: string,
  
  // Email
  EMAIL_PROVIDER: 'smtp' | 'sendgrid' | 'mailgun',
  SENDGRID_API_KEY?: string,
  SMTP_HOST?: string,
  SMTP_PORT?: number,
  
  // Storage
  STORAGE_DRIVER: 'local' | 's3' | 'r2',
  S3_BUCKET?: string,
  S3_REGION?: string,
  S3_ACCESS_KEY_ID?: string,
  S3_SECRET_ACCESS_KEY?: string,
  
  // Security
  JWT_SECRET: string,
  SESSION_SECRET: string,
  ENCRYPTION_KEY: string,
  
  // External Services
  STRIPE_SECRET_KEY?: string,
  RECAPTCHA_SECRET?: string,
  
  // Monitoring
  SENTRY_DSN?: string,
  DATADOG_API_KEY?: string,
}

// Example .env files
// .env.development
```
NODE_ENV=development
PORT=3000
DATABASE_URL=sqlite:./dev.db
REDIS_URL=redis://localhost:6379
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
STORAGE_DRIVER=local
```

// .env.production
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@db:5432/fromcode
REDIS_URL=redis://redis-cluster:6379
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxx
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
JWT_SECRET=super-secret-key-change-in-production
SENTRY_DSN=https://xxx@sentry.io/xxx
```
```

### 13.8 Configuration Best Practices

```typescript
// Load configuration from environment
import { z } from 'zod'

// Validate environment variables at startup
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  // ... more validations
})

// Parse and validate
const env = envSchema.parse(process.env)

// Type-safe configuration
export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  database: parseDatabaseUrl(env.DATABASE_URL),
  cache: parseRedisUrl(env.REDIS_URL),
  // ...
}

// Fail fast on startup if config is invalid
// No runtime surprises!
```

---

## 14. CLI & Developer Experience

### 14.1 CLI Commands

```bash
# Installation
npm install -g fromcode-cli

# Create new project
fromcode create my-app --template=blog
fromcode create my-app --template=ecommerce

# Development server
fromcode dev                    # Start dev server with hot reload
fromcode dev --port=4000        # Custom port

# Plugin development
fromcode plugin create my-plugin --category=cms
fromcode plugin dev my-plugin   # Dev mode with hot reload
fromcode plugin build my-plugin # Build for production
fromcode plugin test my-plugin  # Run tests
fromcode plugin publish my-plugin # Publish to marketplace

# Database
fromcode db:migrate             # Run migrations
fromcode db:seed                # Seed database
fromcode db:backup              # Create backup
fromcode db:restore backup.sql  # Restore backup

# Build & Deploy
fromcode build                  # Production build
fromcode start                  # Start production server
fromcode export                 # Export static site

# Plugin management
fromcode plugins list           # List installed plugins
fromcode plugins install @fromcode/cms
fromcode plugins uninstall cms
fromcode plugins update         # Update all plugins

# Code generation
fromcode generate collection Post --fields=title:string,body:text
fromcode generate api-endpoint /custom-route
fromcode generate migration AddUserRoles

# Testing
fromcode test                   # Run all tests
fromcode test:unit              # Unit tests only
fromcode test:e2e               # E2E tests

# Maintenance
fromcode doctor                 # Check system health
fromcode clean                  # Clean build artifacts
fromcode update                 # Update framework
```

### 14.2 Plugin Generator

```bash
# Interactive plugin creation
$ fromcode plugin create

? Plugin name: My Awesome Plugin
? Plugin slug: my-awesome-plugin
? Category: CMS
? Description: An awesome plugin for content management
? Author: Your Name
? License: MIT

✓ Created plugin scaffold
✓ Generated types
✓ Created example collection
✓ Created admin panel components

Next steps:
  cd plugins/my-awesome-plugin
  fromcode plugin dev
```

---

## 15. Database & Data Layer

### 15.1 Database Abstraction

```typescript
// Multi-database support
interface DatabaseAdapter {
  connect(): Promise<void>
  disconnect(): Promise<void>
  
  // CRUD operations
  create(collection: string, data: any): Promise<Document>
  find(collection: string, query: Query): Promise<Document[]>
  findOne(collection: string, query: Query): Promise<Document | null>
  update(collection: string, id: string, data: any): Promise<Document>
  delete(collection: string, id: string): Promise<void>
  
  // Transactions
  transaction<T>(callback: () => Promise<T>): Promise<T>
  
  // Migrations
  runMigrations(): Promise<void>
}

// Supported databases
const SUPPORTED_DATABASES = {
  postgres: PostgresAdapter,
  mysql: MySQLAdapter,
  sqlite: SQLiteAdapter,
  mongodb: MongoDBAdapter,  // For flexibility
}
```

### 15.2 Collection Schema

```typescript
// Type-safe collection definitions
interface CollectionConfig {
  slug: string
  labels: {
    singular: string
    plural: string
  }
  
  // Fields with validation
  fields: Field[]
  
  // Hooks
  hooks?: {
    beforeValidate?: Hook[]
    beforeChange?: Hook[]
    afterChange?: Hook[]
    beforeRead?: Hook[]
    afterRead?: Hook[]
    beforeDelete?: Hook[]
    afterDelete?: Hook[]
  }
  
  // Access control
  access?: {
    create?: AccessControl
    read?: AccessControl
    update?: AccessControl
    delete?: AccessControl
  }
  
  // Admin UI
  admin?: {
    useAsTitle?: string
    defaultColumns?: string[]
    group?: string
    description?: string
  }
  
  // Versioning
  versions?: {
    drafts?: boolean
    maxPerDoc?: number
  }
  
  // Timestamps
  timestamps?: boolean
  
  // Soft delete
  softDelete?: boolean
}

// Field types
type Field = 
  | TextField
  | NumberField
  | EmailField
  | DateField
  | CheckboxField
  | SelectField
  | RelationshipField
  | RichTextField
  | CodeField
  | JSONField
  | ArrayField
  | GroupField
  | TabsField
```

---

## 16. Frontend Integration Implementation Guide

### 16.1 Step-by-Step: Building the SEO Plugin

```typescript
// STEP 1: Create plugin structure
$ fromcode plugin create seo --with-frontend

// Generated structure:
plugins/seo/
├── plugin.json
├── index.ts
├── frontend/
│   ├── index.ts
│   ├── components/
│   └── styles.css

// STEP 2: Define backend (index.ts)
export const seoPlugin: FromcodePlugin = () => ({
  name: 'seo',
  
  // Extend page collection with SEO fields
  collections: [
    {
      slug: 'pages',
      fields: [
        {
          name: 'seo',
          type: 'group',
          fields: [
            { name: 'title', type: 'text' },
            { name: 'description', type: 'textarea' },
            { name: 'ogImage', type: 'upload' },
          ],
        },
      ],
    },
  ],
  
  // CRITICAL: Define frontend integration
  frontend: {
    // Inject into SSR
    ssr: {
      headInjection: [{
        priority: 1,
        handler: async (context) => ({
          meta: [
            { name: 'description', content: context.page?.seo?.description },
          ],
        }),
      }],
    },
    
    // Register components in slots
    slots: {
      'admin.post.sidebar': './frontend/components/SEOPreview',
    },
  },
})

// STEP 3: Create frontend component (frontend/components/SEOPreview.tsx)
export default function SEOPreview({ post }) {
  return (
    <div>
      <h3>SEO Preview</h3>
      <input 
        type="text" 
        value={post.seo?.title} 
        placeholder="SEO Title"
      />
    </div>
  )
}

// STEP 4: Enable plugin
$ fromcode plugin enable seo

// That's it! The framework automatically:
// ✓ Loads plugin on backend
// ✓ Injects meta tags on every page render
// ✓ Shows SEO preview in admin panel
// ✓ Bundles frontend code
// ✓ Serves plugin assets
```

### 16.2 How It Works Under the Hood

```typescript
// When you enable a plugin, the framework:

// 1. Updates database
await db.update('system-plugins', { slug: 'seo' }, { enabled: true })

// 2. Reloads plugin system
await pluginLoader.reload()

// 3. Registers frontend integration
frontendRegistry.register({
  plugin: 'seo',
  ssr: plugin.frontend.ssr,
  slots: plugin.frontend.slots,
  scripts: plugin.frontend.clientScripts,
})

// 4. Next.js middleware intercepts requests
// middleware.ts
export async function middleware(request) {
  // Get enabled plugins
  const plugins = await getEnabledPlugins()
  
  // Collect SSR injections
  const injections = await Promise.all(
    plugins.map(p => p.frontend?.ssr?.headInjection || [])
  )
  
  // Render page with injections
  const response = NextResponse.next()
  
  // Transform HTML to inject plugin content
  return new HTMLRewriter()
    .on('head', {
      element(head) {
        injections.forEach(injection => {
          head.append(injection.render(), { html: true })
        })
      },
    })
    .transform(response)
}

// 5. Client receives fully rendered page with plugin features
```

### 16.3 Three Patterns for Frontend Integration

#### Pattern 1: SSR Injection (Best for SEO, Analytics)
```typescript
frontend: {
  ssr: {
    headInjection: [/* inject meta tags */],
    bodyInjection: [/* inject scripts */],
  }
}
// ✓ No client-side JavaScript needed
// ✓ Works with JS disabled
// ✓ Perfect for SEO
```

#### Pattern 2: Component Slots (Best for UI Extensions)
```typescript
frontend: {
  slots: {
    'page.sidebar': './components/RelatedPosts',
  }
}
// ✓ Full React component
// ✓ Interactive
// ✓ Access to app state
```

#### Pattern 3: Full Route Override (Best for Custom Pages)
```typescript
frontend: {
  routes: [
    {
      path: '/shop/*',
      component: './pages/Shop',
    }
  ]
}
// ✓ Complete page control
// ✓ Custom routing
// ✓ Full app functionality
```

### 16.4 Real-World Plugin Examples

#### Example 1: Comments Plugin
```typescript
// plugins/comments/index.ts
export const commentsPlugin: FromcodePlugin = () => ({
  name: 'comments',
  
  collections: [
    { slug: 'comments', fields: [/* ... */] }
  ],
  
  frontend: {
    // Inject comment section after post content
    slots: {
      'post.content.after': './frontend/CommentSection',
    },
  },
})

// Frontend automatically shows comments on every post!
```

#### Example 2: Analytics Plugin
```typescript
// plugins/analytics/index.ts
export const analyticsPlugin: FromcodePlugin = () => ({
  name: 'analytics',
  
  frontend: {
    ssr: {
      headInjection: [{
        handler: async (context) => ({
          script: [{
            async: true,
            src: 'https://www.googletagmanager.com/gtag/js?id=GA_ID',
          }],
        }),
      }],
    },
    
    // Client-side tracking
    clientScripts: {
      scripts: [{
        code: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'GA_TRACKING_ID');
        `,
        position: 'head',
      }],
    },
  },
})

// Analytics automatically tracks all pages!
```

#### Example 3: Live Chat Plugin
```typescript
// plugins/livechat/index.ts
export const livechatPlugin: FromcodePlugin = () => ({
  name: 'livechat',
  
  frontend: {
    // Inject chat widget in bottom-right
    slots: {
      'layout.body.end': './frontend/ChatWidget',
    },
    
    clientScripts: {
      scripts: [{
        src: 'https://cdn.livechat.com/widget.js',
        async: true,
      }],
    },
  },
})

// Chat widget appears on every page!
```

### 16.5 Plugin Frontend Hot Reload

```typescript
// Development mode: Hot reload when plugin changes

// fromcode dev --watch-plugins

// Framework watches plugin files
const watcher = chokidar.watch('plugins/*/frontend/**', {
  ignored: /node_modules/,
})

watcher.on('change', async (path) => {
  const plugin = extractPluginSlug(path)
  
  console.log(`♻️  Plugin ${plugin} changed, rebuilding...`)
  
  // 1. Rebuild plugin frontend
  await buildPluginFrontend(plugin)
  
  // 2. Notify browser to reload
  hmrServer.send({
    type: 'plugin-update',
    plugin,
  })
  
  // 3. Browser hot-reloads plugin component
  // No full page refresh needed!
})
```

---

## 17. Implementation Phases

### Phase 1: Core Framework (Months 1-3)
- [ ] Extract core kernel from current codebase
- [ ] Implement plugin loader with sandboxing
- [ ] Build permission system
- [ ] Create database abstraction layer
- [ ] **Build frontend plugin system** (NEW!)
  - [ ] SSR injection pipeline
  - [ ] Component slot registry
  - [ ] Plugin frontend bundler
  - [ ] Runtime plugin loader
- [ ] Develop CLI tool (basic commands)
- [ ] Set up monorepo structure

### Phase 2: Admin Panel (Months 3-4)
- [ ] Build modern admin UI (React/Next.js)
- [ ] Implement dashboard with widgets
- [ ] Create collection management UI
- [ ] Build plugin management interface
- [ ] Add user/role management
- [ ] Implement settings panels

### Phase 3: API Layer (Months 4-5)
- [ ] REST API with auto-generated endpoints
- [ ] GraphQL API (optional)
- [ ] WebSocket support for real-time
- [ ] API authentication (JWT, OAuth)
- [ ] Rate limiting & security
- [ ] API documentation generator

### Phase 4: Plugin Marketplace (Months 5-7)
- [ ] Build marketplace backend
- [ ] Create developer portal
- [ ] Implement plugin verification system
- [ ] Build payment integration (Stripe)
- [ ] Create review & rating system
- [ ] Add analytics dashboard

### Phase 5: Official Plugins (Months 7-9)
- [ ] Migrate existing plugins:
  - Users & Authentication
  - CMS (content management)
  - LMS (learning management)
  - E-commerce
  - MLM (multi-level marketing)
  - Forms
  - SEO
  - Analytics
- [ ] Create high-quality documentation
- [ ] Build example implementations

### Phase 6: Developer Tools (Months 9-10)
- [ ] Enhanced CLI with generators
- [ ] Plugin development SDK
- [ ] Testing framework
- [ ] Debug tools
- [ ] VSCode extension
- [ ] Hot reload for plugins

### Phase 7: Documentation & Marketing (Months 10-12)
- [ ] Comprehensive documentation site
- [ ] Video tutorials
- [ ] Plugin development guides
- [ ] Case studies
- [ ] Community forum
- [ ] Blog & newsletter

### Phase 8: Launch & Growth (Months 12+)
- [ ] Beta testing program
- [ ] Public launch (v1.0)
- [ ] Developer outreach
- [ ] Conference presentations
- [ ] Partner integrations
- [ ] Enterprise features

---

## 18. Naming & Branding

### 18.1 Framework Names (Options)

1. **Fromcode Hub** ✨ (NEW - RECOMMENDED)
   - Pro: "Hub" suggests plugin ecosystem, central marketplace
   - Pro: Modern, catchy, memorable
   - Pro: Emphasizes community & connectivity
   - Pro: Works well with "Hub Marketplace", "Hub CLI", "Hub Plugins"
   - Domain: fromcodehub.com / fromcode.hub

2. **Fromcode Framework** ✓ (Current)
   - Pro: Company name, brand recognition
   - Pro: Professional, clear what it is
   - Con: Generic, doesn't emphasize plugins/ecosystem

3. **TypeStack**
   - Pro: Describes TypeScript + full stack
   - Con: Name might be taken

4. **PluginForge**
   - Pro: Emphasizes plugin system
   - Con: Sounds too specific

5. **Prism Framework**
   - Pro: Modern, represents extensibility (light through prism)
   - Con: Prism.js exists

6. **Catalyst Framework**
   - Pro: Represents acceleration, change
   - Con: Chemical reference unclear

7. **Nexus Framework**
   - Pro: Connection point, modern
   - Con: Multiple frameworks with similar names

**Recommendation: "Fromcode Hub"**
- "Hub" perfectly captures the plugin ecosystem concept
- Central marketplace = "The Hub"
- Community-focused branding
- Easy to say and remember
- Differentiates from generic "framework" naming
- Domain: fromcodehub.com or hub.fromcode.io

### 18.2 Taglines

- "The TypeScript Framework for Everything"
- "WordPress-inspired, Enterprise-ready"
- "Build Anything with Plugins"
- "The Plugin-First TypeScript Framework"
- "Extensibility Without Limits"

---

## 19. Monetization Strategy

### 19.1 Revenue Streams

```typescript
interface RevenueModel {
  // 1. Marketplace (Primary)
  marketplace: {
    // 70/30 split (developer gets 70%)
    commissionRate: 0.30,
    
    // Plugin sales
    pluginSales: {
      oneTime: true,
      subscription: true,
      freemium: true,
    },
    
    // Theme sales
    themeSales: true,
    
    // Estimated: $500K - $2M/year at scale
  }
  
  // 2. Enterprise Support
  enterprise: {
    // Self-hosted support plans
    plans: [
      {
        name: 'Professional',
        price: '$499/month',
        features: [
          'Priority support',
          'SLA guarantees',
          'Security updates',
          'Migration assistance',
        ],
      },
      {
        name: 'Enterprise',
        price: '$999/month',
        features: [
          'All Professional features',
          'Dedicated account manager',
          'Custom development',
          'White-label options',
          'Training sessions',
        ],
      },
    ],
    
    // Estimated: $200K - $1M/year
  }
  
  // 3. Official Plugins (Premium)
  officialPlugins: {
    // High-quality, well-maintained plugins
    examples: [
      'Advanced E-commerce Suite - $299/year',
      'Enterprise MLM System - $499/year',
      'Advanced Analytics - $199/year',
      'White-label Builder - $399/year',
    ],
    
    // Estimated: $100K - $500K/year
  }
  
  // 4. Hosting (Optional)
  hosting: {
    // Managed hosting platform
    plans: [
      'Starter: $29/month',
      'Business: $99/month',
      'Enterprise: Custom',
    ],
    
    // Estimated: $500K+/year at scale
  }
  
  // 5. Training & Certification
  education: {
    courses: [
      'Plugin Development Masterclass - $299',
      'Advanced Fromcode Development - $499',
    ],
    certification: 'Certified Fromcode Developer - $399',
    
    // Estimated: $50K - $200K/year
  }
}
```

---

## 20. Competitive Advantages

### vs. Payload CMS
✓ **Better plugin system** - True extensibility, not limited
✓ **Marketplace** - Ecosystem from day one
✓ **Developer tools** - Superior CLI and DX
✓ **Security** - Granular permissions, sandboxing

### vs. Strapi
✓ **Type safety** - Full TypeScript, better than Strapi's partial support
✓ **Plugin quality** - Curated marketplace vs. Strapi's open system
✓ **Performance** - Optimized plugin loading, better caching

### vs. WordPress
✓ **Modern stack** - TypeScript vs. PHP
✓ **Security** - Secure by default, capability model
✓ **Performance** - Modern architecture, better performance
✓ **Developer experience** - CLI tools, hot reload, TypeScript

**Unique Position:**
- "WordPress extensibility + Modern TypeScript stack + Enterprise security"

---

## 21. Success Metrics (Year 1)

### Technical Metrics
- [ ] 50+ official plugins
- [ ] 200+ community plugins
- [ ] 10,000+ GitHub stars
- [ ] 99.9% uptime
- [ ] < 200ms API response time

### Business Metrics
- [ ] 1,000+ active installations
- [ ] 500+ paying customers
- [ ] $500K+ ARR
- [ ] 100+ plugin developers
- [ ] 50+ enterprise clients

### Community Metrics
- [ ] 10,000+ Discord members
- [ ] 5,000+ forum users
- [ ] 100+ contributors
- [ ] 50+ community meetups
- [ ] 10+ conference talks

---

## 22. Migration Path (From Current System)

### Step 1: Extract Core (Week 1-4)
```bash
# Separate concerns
packages/
  ├── core/           # Plugin loader, security, DI
  ├── database/       # Database abstraction
  ├── api/            # API layer
  └── admin/          # Admin panel
```

### Step 2: Refactor Plugins (Week 5-8)
```typescript
// Standardize plugin structure
plugins/
  ├── users/
  │   ├── plugin.json       # Manifest
  │   ├── index.ts          # Entry point
  │   ├── collections/      # Collections
  │   ├── endpoints/        # API endpoints
  │   └── admin/            # Admin UI
  └── ...
```

### Step 3: Build CLI (Week 9-12)
```bash
# Create fromcode-cli package
npm create fromcode@latest my-app
```

### Step 4: Documentation (Week 13-16)
- Plugin development guide
- API reference
- Migration guide from Payload/Strapi

---

## 23. Next Steps

### Immediate Actions (This Week)
1. **Decision:** Approve plan and commit to framework vision
2. **Setup:** Create `fromcode-framework` monorepo
3. **Team:** Assign developers to core, admin, marketplace
4. **Timeline:** Create detailed sprint plan

### Short-term (Month 1)
1. Extract core from current codebase
2. Set up monorepo with Turborepo/Nx
3. Build basic CLI tool
4. Start admin panel redesign

### Medium-term (Months 2-3)
1. Complete core framework
2. Migrate 10 key plugins
3. Build marketplace MVP
4. Alpha release for testing

### Long-term (Months 4-12)
1. Public beta launch
2. Developer outreach program
3. Build plugin ecosystem
4. Official v1.0 release

---

## 24. Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Plugin conflicts | Dependency resolution, version compatibility checks |
| Security vulnerabilities | Code signing, security audits, sandboxing |
| Performance issues | Lazy loading, caching, optimization |
| Breaking changes | Semantic versioning, deprecation warnings |

### Business Risks
| Risk | Mitigation |
|------|------------|
| Low adoption | Developer outreach, free tier, great docs |
| Marketplace competition | Curated plugins, quality > quantity |
| Enterprise hesitation | Support plans, SLAs, case studies |
| Funding | Bootstrapped approach, early revenue focus |

---

## 25. Testing & Quality Assurance

### 25.1 Plugin Testing Framework

```typescript
// Built-in testing utilities for plugins
import { describe, it, expect } from '@fromcode/testing'
import { createTestContext } from '@fromcode/testing'

interface PluginTestSuite {
  // Unit tests
  unit: {
    hooks: HookTest[],
    utilities: UtilityTest[],
    validators: ValidatorTest[],
  },
  
  // Integration tests
  integration: {
    database: DBTest[],
    api: APITest[],
    pluginCommunication: PluginCommTest[],
  },
  
  // E2E tests
  e2e: {
    userFlows: E2ETest[],
    admin: AdminTest[],
    frontend: FrontendTest[],
  },
}

// Example: Testing a plugin
describe('SEO Plugin', () => {
  let ctx: PluginContext
  
  beforeEach(async () => {
    // Create isolated test environment
    ctx = await createTestContext({
      plugins: ['seo'],
      database: 'sqlite::memory:',
      clean: true,
    })
  })
  
  afterEach(async () => {
    await ctx.cleanup()
  })
  
  it('should inject meta tags', async () => {
    const page = await ctx.db.create('pages', {
      title: 'Test Page',
      seo: {
        description: 'Test Description',
      },
    })
    
    const html = await ctx.render(`/pages/${page.slug}`)
    
    expect(html).toContain('<meta name="description" content="Test Description">')
  })
  
  it('should generate sitemap', async () => {
    await ctx.db.create('pages', { title: 'Page 1', slug: 'page-1' })
    await ctx.db.create('pages', { title: 'Page 2', slug: 'page-2' })
    
    const response = await ctx.api.get('/sitemap.xml')
    
    expect(response.status).toBe(200)
    expect(response.body).toContain('page-1')
    expect(response.body).toContain('page-2')
  })
})
```

### 25.2 Marketplace Quality Gates

```typescript
// Plugins must pass quality checks before marketplace approval
interface QualityGate {
  // Code quality
  codeQuality: {
    linting: {
      required: true,
      rules: 'strict',
      maxErrors: 0,
      maxWarnings: 10,
    },
    
    typeChecking: {
      required: true,
      strict: true,
      noImplicitAny: true,
    },
    
    complexity: {
      maxCyclomaticComplexity: 10,
      maxCognitiveComplexity: 15,
      maxFileLength: 500,
    },
  },
  
  // Test coverage
  coverage: {
    required: true,
    minimum: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
    
    // Must have tests for critical paths
    criticalPaths: {
      installation: true,
      activation: true,
      deactivation: true,
      uninstallation: true,
    },
  },
  
  // Security checks
  security: {
    // No known vulnerabilities
    vulnerabilities: {
      critical: 0,
      high: 0,
      medium: 0,
    },
    
    // Code signing required
    signed: true,
    
    // No malicious patterns
    malwareCheck: true,
    
    // Dependencies audit
    dependencyAudit: true,
  },
  
  // Performance
  performance: {
    // Load time limits
    loadTime: {
      backend: '100ms',
      frontend: '200ms',
    },
    
    // Memory limits
    memoryUsage: {
      idle: '50MB',
      active: '200MB',
    },
    
    // No memory leaks
    memoryLeaks: false,
  },
  
  // Documentation
  documentation: {
    readme: true,
    changelog: true,
    apiDocs: true,
    examples: true,
    
    // Minimum documentation score
    score: 8.0,  // out of 10
  },
  
  // Compatibility
  compatibility: {
    // Test on multiple Node versions
    nodeVersions: ['18.x', '20.x', '22.x'],
    
    // Test on multiple databases
    databases: ['postgres', 'mysql', 'sqlite'],
    
    // Test with common plugins
    plugins: ['users', 'auth', 'cms'],
  },
}

// Automated quality check
class QualityChecker {
  async checkPlugin(plugin: PluginPackage): Promise<QualityReport> {
    const results = {
      codeQuality: await this.checkCodeQuality(plugin),
      coverage: await this.checkCoverage(plugin),
      security: await this.checkSecurity(plugin),
      performance: await this.checkPerformance(plugin),
      documentation: await this.checkDocumentation(plugin),
      compatibility: await this.checkCompatibility(plugin),
    }
    
    const passed = Object.values(results).every(r => r.passed)
    const score = this.calculateScore(results)
    
    return {
      passed,
      score,
      results,
      recommendations: this.generateRecommendations(results),
    }
  }
}
```

### 25.3 Continuous Testing

```typescript
// CI/CD pipeline for plugins
interface CIPipeline {
  // On every commit
  onCommit: {
    steps: [
      'Lint code',
      'Type check',
      'Run unit tests',
      'Check coverage',
      'Security scan',
    ],
  },
  
  // On pull request
  onPR: {
    steps: [
      'All commit checks',
      'Run integration tests',
      'Check compatibility',
      'Performance benchmarks',
      'Generate preview',
    ],
  },
  
  // On release
  onRelease: {
    steps: [
      'All PR checks',
      'Run E2E tests',
      'Full quality gate',
      'Build plugin',
      'Sign plugin',
      'Publish to marketplace',
    ],
  },
}

// GitHub Actions example
// .github/workflows/test.yml
```yaml
name: Test Plugin

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
        database: [postgres, mysql, sqlite]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run type-check
      
      - name: Test
        run: npm test
        env:
          DATABASE: ${{ matrix.database }}
      
      - name: Coverage
        run: npm run coverage
      
      - name: Security scan
        run: npm audit
```
```

### 25.4 Plugin Testing CLI

```bash
# Test plugin locally
fromcode plugin test my-plugin

# Test with coverage
fromcode plugin test my-plugin --coverage

# Test specific suite
fromcode plugin test my-plugin --suite=unit
fromcode plugin test my-plugin --suite=integration
fromcode plugin test my-plugin --suite=e2e

# Test against specific database
fromcode plugin test my-plugin --db=postgres

# Test compatibility
fromcode plugin test my-plugin --compatibility

# Run quality gate
fromcode plugin quality-check my-plugin

# Generate test report
fromcode plugin test my-plugin --report=html
```

---

## 26. Monitoring & Observability

### 26.1 Application Performance Monitoring (APM)

```typescript
// Built-in APM integration
interface APMConfig {
  // APM provider
  provider: 'datadog' | 'newrelic' | 'elastic' | 'sentry' | 'custom',
  
  // Datadog APM
  datadog?: {
    apiKey: string,
    site: 'datadoghq.com' | 'datadoghq.eu',
    service: 'fromcode-hub',
    env: 'production',
    version: string,
    
    // Trace sampling
    tracing: {
      enabled: true,
      sampleRate: 1.0,  // 100% in production
      runtimeMetrics: true,
    },
    
    // Profiling
    profiling: {
      enabled: true,
      cpuProfileRate: 1000,  // Hz
      heapProfileRate: 512,   // KB
    },
  },
  
  // Custom metrics
  metrics: {
    // Track plugin metrics
    plugins: {
      loadTime: true,
      executionTime: true,
      memoryUsage: true,
      errorRate: true,
    },
    
    // Track API metrics
    api: {
      requestRate: true,
      responseTime: true,
      errorRate: true,
      statusCodes: true,
    },
    
    // Track database metrics
    database: {
      queryTime: true,
      connectionPool: true,
      slowQueries: true,
    },
  },
}

// Instrument plugin code
import { trace } from '@fromcode/monitoring'

export const myPlugin: FromcodePlugin = () => ({
  name: 'my-plugin',
  
  async onEnable(ctx) {
    // Trace execution
    await trace('plugin:enable', { plugin: 'my-plugin' }, async () => {
      // Plugin initialization
      await initializePlugin()
    })
  },
  
  endpoints: [{
    path: '/my-endpoint',
    method: 'get',
    handler: trace('endpoint:my-endpoint', async (req, res) => {
      // Automatically traced
      const data = await fetchData()
      res.json(data)
    }),
  }],
})
```

### 26.2 Distributed Tracing

```typescript
// OpenTelemetry integration
import { trace, context } from '@opentelemetry/api'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

interface TracingConfig {
  // Trace provider
  provider: 'opentelemetry',
  
  // Exporters
  exporters: Array<{
    type: 'jaeger' | 'zipkin' | 'otlp',
    endpoint: string,
  }>,
  
  // Sampling
  sampling: {
    strategy: 'always' | 'probabilistic' | 'rate-limited',
    rate?: number,  // For probabilistic
  },
  
  // Instrumentation
  instrumentation: {
    http: true,
    database: true,
    redis: true,
    plugins: true,
  },
}

// Example: Trace plugin-to-plugin communication
const tracer = trace.getTracer('fromcode-hub')

async function callPlugin(targetPlugin: string, method: string) {
  const span = tracer.startSpan('plugin.call', {
    attributes: {
      'plugin.target': targetPlugin,
      'plugin.method': method,
    },
  })
  
  try {
    const result = await executePluginMethod(targetPlugin, method)
    span.setStatus({ code: SpanStatusCode.OK })
    return result
  } catch (error) {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR })
    throw error
  } finally {
    span.end()
  }
}
```

### 26.3 Real-Time Metrics Dashboard

```typescript
// Admin dashboard metrics
interface MetricsDashboard {
  // System health
  system: {
    cpu: Gauge,
    memory: Gauge,
    disk: Gauge,
    uptime: Counter,
  },
  
  // Plugin metrics
  plugins: {
    enabled: Gauge,
    loadTime: Histogram,
    errorRate: Counter,
    activeRequests: Gauge,
  },
  
  // API metrics
  api: {
    requestRate: Counter,
    responseTime: Histogram,
    errorRate: Counter,
    activeConnections: Gauge,
  },
  
  // Database metrics
  database: {
    connections: Gauge,
    queryTime: Histogram,
    slowQueries: Counter,
    errors: Counter,
  },
  
  // Business metrics
  business: {
    users: Gauge,
    orders: Counter,
    revenue: Counter,
    conversions: Counter,
  },
}

// Expose metrics endpoint
// GET /api/metrics (Prometheus format)
import { register } from 'prom-client'

app.get('/api/metrics', (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(register.metrics())
})
```

### 26.4 Plugin Performance Profiling

```typescript
// Profile plugin performance
interface PluginProfiler {
  // CPU profiling
  cpu: {
    enabled: boolean,
    sampleInterval: number,  // ms
    duration: number,        // seconds
  },
  
  // Memory profiling
  memory: {
    enabled: boolean,
    heapSnapshot: boolean,
    allocationProfile: boolean,
  },
  
  // Flamegraph generation
  flamegraph: {
    enabled: boolean,
    format: 'svg' | 'json',
  },
}

// CLI: Profile a plugin
$ fromcode plugin profile my-plugin --cpu --duration=60
$ fromcode plugin profile my-plugin --memory --heap-snapshot
$ fromcode plugin profile my-plugin --flamegraph

// Analyze results
$ fromcode plugin analyze-profile profile.cpuprofile
```

### 26.5 Alert System

```typescript
// Alert configuration
interface AlertConfig {
  channels: Array<{
    type: 'email' | 'slack' | 'webhook' | 'pagerduty',
    
    // Email
    email?: {
      to: string[],
      from: string,
    },
    
    // Slack
    slack?: {
      webhookUrl: string,
      channel: string,
    },
    
    // Webhook
    webhook?: {
      url: string,
      method: 'POST',
      headers: Record<string, string>,
    },
  }>,
  
  // Alert rules
  rules: Array<{
    name: string,
    condition: AlertCondition,
    severity: 'critical' | 'warning' | 'info',
    channels: string[],
    throttle: number,  // Seconds between alerts
  }>,
}

// Example alert rules
const ALERT_RULES = [
  {
    name: 'High Error Rate',
    condition: {
      metric: 'error_rate',
      operator: '>',
      threshold: 0.05,  // 5%
      duration: '5m',
    },
    severity: 'critical',
    channels: ['slack', 'pagerduty'],
  },
  {
    name: 'Plugin Load Time',
    condition: {
      metric: 'plugin_load_time',
      operator: '>',
      threshold: 1000,  // 1 second
      duration: '1m',
    },
    severity: 'warning',
    channels: ['slack'],
  },
  {
    name: 'Database Connection Pool',
    condition: {
      metric: 'db_pool_exhausted',
      operator: '==',
      threshold: true,
    },
    severity: 'critical',
    channels: ['slack', 'pagerduty', 'email'],
  },
]
```

### 26.6 Log Aggregation

```typescript
// Structured logging with aggregation
import { Logger } from '@fromcode/logger'

const logger = new Logger({
  level: 'info',
  
  // JSON formatting for aggregation
  format: 'json',
  
  // Include context
  context: {
    service: 'fromcode-hub',
    env: 'production',
    version: '1.0.0',
  },
  
  // Send to aggregation service
  transports: [
    {
      type: 'cloudwatch',
      logGroup: '/fromcode/production',
      logStream: 'api',
    },
    {
      type: 'datadog',
      apiKey: process.env.DATADOG_API_KEY,
    },
  ],
})

// Plugin logging
export const myPlugin: FromcodePlugin = () => ({
  name: 'my-plugin',
  
  async onEnable(ctx) {
    // Namespaced logger
    ctx.logger.info('Plugin enabled', {
      plugin: 'my-plugin',
      version: '1.0.0',
    })
  },
  
  endpoints: [{
    path: '/endpoint',
    method: 'get',
    handler: async (req, res) => {
      ctx.logger.info('Endpoint called', {
        path: req.path,
        method: req.method,
        user: req.user?.id,
      })
    },
  }],
})
```

---

## 27. Error Handling & Recovery

### 27.1 Plugin Crash Handling

```typescript
// Robust error handling for plugins
class PluginErrorHandler {
  async executePluginSafely(
    plugin: Plugin,
    method: string,
    ...args: any[]
  ): Promise<any> {
    try {
      return await plugin[method](...args)
    } catch (error) {
      // Log error
      await this.logError(plugin, method, error)
      
      // Decide recovery strategy
      const strategy = this.getRecoveryStrategy(error)
      
      switch (strategy) {
        case 'retry':
          return await this.retryWithBackoff(plugin, method, args)
        
        case 'disable':
          await this.disablePlugin(plugin, error)
          throw error
        
        case 'isolate':
          await this.isolatePlugin(plugin)
          return this.getFallbackResponse(method)
        
        case 'restart':
          await this.restartPlugin(plugin)
          return await plugin[method](...args)
        
        default:
          throw error
      }
    }
  }
  
  private getRecoveryStrategy(error: Error): RecoveryStrategy {
    // Transient errors: Retry
    if (error instanceof NetworkError || error instanceof TimeoutError) {
      return 'retry'
    }
    
    // Critical errors: Disable
    if (error instanceof SecurityError || error instanceof CorruptionError) {
      return 'disable'
    }
    
    // Resource errors: Restart
    if (error instanceof MemoryError || error instanceof ResourceError) {
      return 'restart'
    }
    
    // Unknown errors: Isolate
    return 'isolate'
  }
  
  private async retryWithBackoff(
    plugin: Plugin,
    method: string,
    args: any[],
    maxRetries = 3
  ): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Exponential backoff
        await sleep(Math.pow(2, i) * 1000)
        return await plugin[method](...args)
      } catch (error) {
        if (i === maxRetries - 1) throw error
      }
    }
  }
}
```

### 27.2 Error Boundaries for Frontend Plugins

```typescript
// React error boundary for plugin components
import { Component, ErrorInfo } from 'react'

class PluginErrorBoundary extends Component<{
  plugin: string,
  onError?: (error: Error, info: ErrorInfo) => void,
}> {
  state = {
    hasError: false,
    error: null as Error | null,
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log error to monitoring service
    logger.error('Plugin component crashed', {
      plugin: this.props.plugin,
      error: error.message,
      componentStack: info.componentStack,
    })
    
    // Notify plugin developer
    notifyPluginDeveloper(this.props.plugin, error, info)
    
    // Call custom error handler
    this.props.onError?.(error, info)
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="plugin-error">
          <h3>Plugin Error</h3>
          <p>The {this.props.plugin} plugin encountered an error.</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Retry
          </button>
          <button onClick={() => disablePlugin(this.props.plugin)}>
            Disable Plugin
          </button>
        </div>
      )
    }
    
    return this.props.children
  }
}

// Usage: Wrap all plugin components
export function PluginSlot({ name }: { name: string }) {
  const components = usePluginComponents(name)
  
  return (
    <>
      {components.map((Component, index) => (
        <PluginErrorBoundary 
          key={index} 
          plugin={Component.pluginSlug}
        >
          <Component />
        </PluginErrorBoundary>
      ))}
    </>
  )
}
```

### 27.3 Graceful Degradation Strategies

```typescript
// Fallback mechanisms when plugins fail
interface GracefulDegradation {
  // 1. Fallback to core functionality
  coreFallback: {
    enabled: true,
    // If SEO plugin fails, use basic meta tags
    example: 'Use core SEO instead of plugin',
  },
  
  // 2. Cached responses
  cache: {
    enabled: true,
    // Serve cached data if plugin is down
    ttl: 3600,  // 1 hour
    staleWhileRevalidate: true,
  },
  
  // 3. Feature flagging
  featureFlags: {
    enabled: true,
    // Disable features that depend on broken plugin
    disableDependentFeatures: true,
  },
  
  // 4. Circuit breaker
  circuitBreaker: {
    enabled: true,
    threshold: 5,        // Failures before opening
    timeout: 60000,      // 60s before retry
    halfOpenRequests: 3, // Test requests when half-open
  },
}

// Circuit breaker implementation
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  private failureCount = 0
  private lastFailureTime?: number
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Open: Block requests
    if (this.state === 'open') {
      const timeSinceFailure = Date.now() - (this.lastFailureTime || 0)
      
      if (timeSinceFailure > this.config.timeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }
    
    try {
      const result = await fn()
      
      // Success: Reset or close
      if (this.state === 'half-open') {
        this.state = 'closed'
      }
      this.failureCount = 0
      
      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()
      
      // Open circuit if threshold exceeded
      if (this.failureCount >= this.config.threshold) {
        this.state = 'open'
        await this.notifyAdminCircuitOpen()
      }
      
      throw error
    }
  }
}
```

### 27.4 Error Reporting to Developers

```typescript
// Automatic error reporting for plugin developers
interface ErrorReport {
  // Error details
  error: {
    message: string,
    stack: string,
    type: string,
  },
  
  // Context
  context: {
    plugin: string,
    version: string,
    method: string,
    timestamp: number,
  },
  
  // Environment
  environment: {
    nodeVersion: string,
    frameworkVersion: string,
    os: string,
    memory: number,
    cpu: number,
  },
  
  // User impact
  impact: {
    affectedUsers: number,
    frequency: number,
    severity: 'low' | 'medium' | 'high' | 'critical',
  },
}

// Send error reports to plugin developers
class ErrorReporter {
  async reportError(plugin: Plugin, error: Error) {
    const report = await this.generateReport(plugin, error)
    
    // Group similar errors
    const groupKey = this.getErrorGroupKey(error)
    const existingGroup = await this.findErrorGroup(groupKey)
    
    if (existingGroup) {
      // Increment count
      await this.incrementErrorCount(existingGroup)
    } else {
      // Create new error group
      await this.createErrorGroup(report)
      
      // Notify developer
      await this.notifyDeveloper(plugin, report)
    }
  }
  
  private async notifyDeveloper(plugin: Plugin, report: ErrorReport) {
    // Send email to plugin developer
    await emailService.send({
      to: plugin.author.email,
      subject: `Error in ${plugin.name}`,
      template: 'plugin-error',
      data: report,
    })
    
    // Create issue in plugin repo (if public)
    if (plugin.repository) {
      await githubAPI.createIssue({
        repo: plugin.repository,
        title: `[Auto-reported] ${report.error.message}`,
        body: this.formatErrorReport(report),
        labels: ['bug', 'auto-reported'],
      })
    }
  }
}
```

### 27.5 Automatic Recovery Mechanisms

```typescript
// Self-healing system for plugins
class PluginRecoverySystem {
  // Watchdog timer
  private watchdogs = new Map<string, NodeJS.Timer>()
  
  startWatchdog(plugin: Plugin) {
    const timer = setInterval(async () => {
      // Check plugin health
      const healthy = await this.checkPluginHealth(plugin)
      
      if (!healthy) {
        await this.attemptRecovery(plugin)
      }
    }, 30000)  // Check every 30 seconds
    
    this.watchdogs.set(plugin.slug, timer)
  }
  
  private async attemptRecovery(plugin: Plugin) {
    console.log(`[Recovery] Attempting to recover plugin: ${plugin.slug}`)
    
    // 1. Try soft restart
    try {
      await this.restartPlugin(plugin)
      console.log(`[Recovery] Soft restart successful`)
      return
    } catch (error) {
      console.error(`[Recovery] Soft restart failed`, error)
    }
    
    // 2. Try hard restart (full reload)
    try {
      await this.reloadPlugin(plugin)
      console.log(`[Recovery] Hard restart successful`)
      return
    } catch (error) {
      console.error(`[Recovery] Hard restart failed`, error)
    }
    
    // 3. Disable plugin and alert admin
    await this.disablePlugin(plugin)
    await this.alertAdmin({
      severity: 'critical',
      message: `Plugin ${plugin.name} could not be recovered and has been disabled`,
      plugin: plugin.slug,
    })
  }
  
  private async checkPluginHealth(plugin: Plugin): Promise<boolean> {
    try {
      // Check if plugin responds
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
      
      await Promise.race([
        plugin.healthCheck?.(),
        timeout,
      ])
      
      return true
    } catch (error) {
      return false
    }
  }
}
```

---

## 28. Plugin Conflict Resolution

### 28.1 Conflict Detection System

```typescript
// Detect conflicts between plugins
interface ConflictDetector {
  // Types of conflicts
  conflicts: {
    // Route conflicts
    routes: Array<{
      path: string,
      plugins: string[],  // Multiple plugins registering same route
    }>,
    
    // Hook conflicts
    hooks: Array<{
      event: string,
      plugins: string[],  // Conflicting hook handlers
      priority: number[],
    }>,
    
    // Component overrides
    components: Array<{
      component: string,
      plugins: string[],  // Multiple plugins overriding same component
    }>,
    
    // Database schema
    schema: Array<{
      table: string,
      plugins: string[],  // Schema conflicts
    }>,
    
    // Dependencies
    dependencies: Array<{
      plugin: string,
      conflicts: string[],  // Incompatible versions
    }>,
  },
}

// Run conflict detection before enabling plugin
class ConflictDetectionService {
  async detectConflicts(
    newPlugin: Plugin,
    enabledPlugins: Plugin[]
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = []
    
    // Check route conflicts
    const routeConflicts = this.checkRouteConflicts(newPlugin, enabledPlugins)
    conflicts.push(...routeConflicts)
    
    // Check hook conflicts
    const hookConflicts = this.checkHookConflicts(newPlugin, enabledPlugins)
    conflicts.push(...hookConflicts)
    
    // Check component override conflicts
    const componentConflicts = this.checkComponentConflicts(newPlugin, enabledPlugins)
    conflicts.push(...componentConflicts)
    
    // Check dependency conflicts
    const depConflicts = this.checkDependencyConflicts(newPlugin, enabledPlugins)
    conflicts.push(...depConflicts)
    
    return conflicts
  }
  
  private checkRouteConflicts(
    newPlugin: Plugin,
    enabledPlugins: Plugin[]
  ): Conflict[] {
    const conflicts: Conflict[] = []
    const newRoutes = this.getPluginRoutes(newPlugin)
    
    for (const route of newRoutes) {
      for (const plugin of enabledPlugins) {
        const existingRoutes = this.getPluginRoutes(plugin)
        
        if (existingRoutes.some(r => r.path === route.path)) {
          conflicts.push({
            type: 'route',
            severity: 'high',
            plugins: [newPlugin.slug, plugin.slug],
            resource: route.path,
            resolution: 'priority-based',
          })
        }
      }
    }
    
    return conflicts
  }
}
```

### 28.2 Priority System for Component Overrides

```typescript
// Resolve conflicts using priority
interface PrioritySystem {
  // Each plugin has a priority
  pluginPriority: Map<string, number>,
  
  // Higher priority wins
  resolveConflict(plugins: string[]): string {
    return plugins.reduce((winner, plugin) => {
      const winnerPriority = this.pluginPriority.get(winner) || 0
      const pluginPriority = this.pluginPriority.get(plugin) || 0
      return pluginPriority > winnerPriority ? plugin : winner
    })
  },
}

// Set plugin priority
interface PluginManifest {
  // ... other fields
  
  priority?: number,  // Default: 100
  // Higher priority = loads first, takes precedence
  
  // Examples:
  // Core plugins: 1000
  // Theme plugins: 500
  // Regular plugins: 100
  // User plugins: 50
}

// Component override resolution
class ComponentResolver {
  resolveComponent(componentPath: string): React.ComponentType {
    // Get all plugins that override this component
    const overrides = this.getComponentOverrides(componentPath)
    
    if (overrides.length === 0) {
      // Use core component
      return this.getCoreComponent(componentPath)
    }
    
    if (overrides.length === 1) {
      // Single override, use it
      return overrides[0].component
    }
    
    // Multiple overrides: Use highest priority
    const winner = overrides.reduce((highest, current) => {
      return current.priority > highest.priority ? current : highest
    })
    
    // Warn about conflict
    console.warn(`[Conflict] Multiple plugins override ${componentPath}`, {
      overrides: overrides.map(o => o.plugin),
      winner: winner.plugin,
    })
    
    return winner.component
  }
}
```

### 28.3 Conflict Resolution UI

```typescript
// Admin panel: Conflict management
interface ConflictManagementUI {
  // View all conflicts
  listConflicts(): Conflict[],
  
  // Manual resolution
  resolveConflict(conflictId: string, resolution: Resolution): void,
  
  // Set plugin priorities
  setPriority(plugin: string, priority: number): void,
  
  // Disable conflicting feature
  disableFeature(plugin: string, feature: string): void,
}

// Conflict resolution options
type Resolution = 
  | { type: 'prefer', plugin: string }       // Prefer specific plugin
  | { type: 'disable', plugin: string }      // Disable one plugin
  | { type: 'merge', strategy: string }      // Merge both (if possible)
  | { type: 'custom', handler: Function }    // Custom resolution

// Template-based conflict resolution
interface ConflictResolverTemplate {
  card: {
    header: {
      icon: {
        type: 'alert',
        severity: '{conflict.severity}',
      },
      title: '{conflict.type} Conflict',
    },
    
    details: {
      message: 'Plugins {conflict.plugins.join(", ")} conflict on {conflict.resource}',
      formatting: {
        plugins: 'code',
        resource: 'code',
      },
    },
    
    actions: {
      // Generate button for each plugin
      forEach: '{conflict.plugins}',
      button: {
        label: 'Use {plugin}',
        action: 'resolveConflict',
        params: {
          conflictId: '{conflict.id}',
          resolution: { type: 'prefer', plugin: '{plugin}' },
        },
      },
      
      // Advanced options button
      additional: [
        {
          label: 'Advanced Options',
          action: 'showAdvancedOptions',
          params: { conflict: '{conflict}' },
        },
      ],
    },
  },
}
```

### 28.4 Automatic Conflict Prevention

```typescript
// Prevent conflicts at plugin installation
class ConflictPrevention {
  async validatePluginInstallation(plugin: Plugin): Promise<ValidationResult> {
    // Get currently enabled plugins
    const enabled = await this.getEnabledPlugins()
    
    // Check for conflicts
    const conflicts = await this.detectConflicts(plugin, enabled)
    
    if (conflicts.length === 0) {
      return { valid: true }
    }
    
    // Check if conflicts are resolvable
    const resolvable = conflicts.every(c => this.isResolvable(c))
    
    if (resolvable) {
      return {
        valid: true,
        warnings: conflicts.map(c => ({
          message: `Conflict with ${c.plugins.join(', ')}`,
          resolution: c.resolution,
        })),
      }
    }
    
    // Critical conflicts: Block installation
    return {
      valid: false,
      errors: conflicts.filter(c => c.severity === 'critical'),
      message: 'Cannot install plugin due to critical conflicts',
    }
  }
}

// CLI validation
$ fromcode plugin install my-plugin

⚠️  Conflicts detected:
  - Route conflict with 'other-plugin' on /shop
  - Component override conflict on Header

Resolution:
  - Route: Use priority system (my-plugin: 100, other-plugin: 50)
  - Component: my-plugin will override (higher priority)

Continue with installation? [Y/n]
```

---

## 29. Webhooks & Event System

### 29.1 Webhook Architecture

```typescript
// Built-in webhook system
interface WebhookConfig {
  // Webhook registration
  webhooks: Array<{
    id: string,
    name: string,
    url: string,
    events: string[],        // Events to subscribe to
    secret: string,          // For signature verification
    active: boolean,
    
    // Retry configuration
    retry: {
      maxAttempts: number,
      backoff: 'fixed' | 'exponential',
      initialDelay: number,
    },
    
    // Headers
    headers?: Record<string, string>,
    
    // Filters
    filters?: {
      collections?: string[],
      plugins?: string[],
      conditions?: any,
    },
  }>,
}

// Event types
enum WebhookEvent {
  // Collection events
  'collection.created' = 'collection.created',
  'collection.updated' = 'collection.updated',
  'collection.deleted' = 'collection.deleted',
  
  // Plugin events
  'plugin.installed' = 'plugin.installed',
  'plugin.enabled' = 'plugin.enabled',
  'plugin.disabled' = 'plugin.disabled',
  'plugin.updated' = 'plugin.updated',
  
  // User events
  'user.created' = 'user.created',
  'user.updated' = 'user.updated',
  'user.login' = 'user.login',
  'user.logout' = 'user.logout',
  
  // System events
  'system.backup.completed' = 'system.backup.completed',
  'system.migration.completed' = 'system.migration.completed',
  'system.error' = 'system.error',
  
  // Custom events
  'custom.*' = 'custom.*',
}

// Webhook delivery
class WebhookDelivery {
  async deliver(webhook: Webhook, event: Event): Promise<void> {
    const payload = this.buildPayload(webhook, event)
    const signature = this.generateSignature(payload, webhook.secret)
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Fromcode-Event': event.type,
          'X-Fromcode-Signature': signature,
          'X-Fromcode-Delivery': event.id,
          ...webhook.headers,
        },
        body: JSON.stringify(payload),
        timeout: 30000,  // 30s timeout
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      // Log successful delivery
      await this.logDelivery(webhook, event, 'success')
    } catch (error) {
      // Log failed delivery
      await this.logDelivery(webhook, event, 'failed', error)
      
      // Retry if configured
      if (webhook.retry.maxAttempts > 0) {
        await this.scheduleRetry(webhook, event, 1)
      }
    }
  }
  
  private buildPayload(webhook: Webhook, event: Event) {
    return {
      id: event.id,
      event: event.type,
      timestamp: event.timestamp,
      data: event.data,
      metadata: {
        environment: process.env.NODE_ENV,
        version: FRAMEWORK_VERSION,
      },
    }
  }
  
  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(JSON.stringify(payload))
    return hmac.digest('hex')
  }
}
```

### 29.2 Event Bus System

```typescript
// Central event bus for plugin communication
class EventBus {
  private listeners = new Map<string, Set<EventListener>>()
  
  // Emit event
  async emit(event: string, data: any): Promise<void> {
    const listeners = this.listeners.get(event) || new Set()
    
    // Execute listeners in parallel
    await Promise.all(
      Array.from(listeners).map(listener => 
        this.executeSafely(listener, event, data)
      )
    )
    
    // Trigger webhooks
    await this.triggerWebhooks(event, data)
  }
  
  // Subscribe to event
  on(event: string, listener: EventListener): Unsubscribe {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    
    this.listeners.get(event)!.add(listener)
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener)
    }
  }
  
  // Subscribe with wildcard
  onPattern(pattern: string, listener: EventListener): Unsubscribe {
    const regex = this.patternToRegex(pattern)
    
    return this.on('*', async (event, data) => {
      if (regex.test(event)) {
        await listener(event, data)
      }
    })
  }
  
  private async executeSafely(
    listener: EventListener,
    event: string,
    data: any
  ): Promise<void> {
    try {
      await listener(event, data)
    } catch (error) {
      console.error(`[EventBus] Listener error for ${event}:`, error)
      
      // Don't let one listener failure affect others
    }
  }
}

// Usage in plugins
export const myPlugin: FromcodePlugin = () => ({
  name: 'my-plugin',
  
  async onEnable(ctx) {
    // Listen to events
    ctx.events.on('collection.created', async (event, data) => {
      console.log('New document created:', data)
      
      // React to event
      await doSomething(data)
    })
    
    // Listen with wildcard
    ctx.events.onPattern('user.*', async (event, data) => {
      // Matches: user.created, user.updated, user.deleted
      await trackUserActivity(event, data)
    })
    
    // Emit custom events
    ctx.events.emit('my-plugin:action', { foo: 'bar' })
  },
})
```

### 29.3 Webhook Management UI

```typescript
// Admin panel: Webhook management
interface WebhookManagementUI {
  // List webhooks
  listWebhooks(): Webhook[],
  
  // Create webhook
  createWebhook(config: WebhookConfig): Webhook,
  
  // Test webhook
  testWebhook(id: string, event?: string): Promise<TestResult>,
  
  // View delivery logs
  viewLogs(id: string): WebhookLog[],
  
  // Retry failed delivery
  retryDelivery(logId: string): Promise<void>,
}

// Template-based UI configuration
interface WebhookManagerTemplate {
  layout: {
    type: 'page',
    title: 'Webhooks',
    actions: [
      {
        type: 'button',
        label: 'Create Webhook',
        action: 'showCreateDialog',
      },
    ],
  },
  
  // Data table configuration
  table: {
    dataSource: 'api.webhooks.list',
    columns: [
      {
        field: 'name',
        label: 'Name',
        type: 'text',
      },
      {
        field: 'url',
        label: 'URL',
        type: 'code',
      },
      {
        field: 'events',
        label: 'Events',
        type: 'text',
        format: (value) => value.join(', '),
      },
      {
        field: 'active',
        label: 'Status',
        type: 'badge',
        mapping: {
          true: { label: 'Active', color: 'green' },
          false: { label: 'Inactive', color: 'gray' },
        },
      },
      {
        field: 'actions',
        label: 'Actions',
        type: 'actions',
        items: [
          { label: 'Test', action: 'testWebhook', param: '{webhook.id}' },
          { label: 'Logs', action: 'viewLogs', param: '{webhook.id}' },
          { label: 'Edit', action: 'editWebhook', param: '{webhook}' },
        ],
      },
    ],
  },
}
```

### 29.4 Webhook Security

```typescript
// Secure webhook delivery
interface WebhookSecurity {
  // Signature verification (receiver side)
  verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  },
  
  // IP whitelisting
  ipWhitelist?: string[],
  
  // SSL/TLS only
  requireHTTPS: true,
  
  // Replay protection
  replayProtection: {
    enabled: true,
    windowSeconds: 300,  // 5 minutes
  },
}

// Example: Verify webhook in your endpoint
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-fromcode-signature']
  const payload = JSON.stringify(req.body)
  
  // Verify signature
  if (!verifySignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }
  
  // Verify timestamp (replay protection)
  const timestamp = req.body.timestamp
  if (Date.now() - timestamp > 300000) {  // 5 minutes
    return res.status(401).json({ error: 'Request too old' })
  }
  
  // Process webhook
  await processWebhook(req.body)
  
  res.json({ success: true })
})
```

---

## 30. Search & Indexing

### 30.1 Full-Text Search Architecture

```typescript
// Multi-backend search system
interface SearchConfig {
  // Search backend
  engine: 'postgres' | 'elasticsearch' | 'meilisearch' | 'algolia' | 'typesense',
  
  // PostgreSQL full-text search
  postgres?: {
    language: 'english' | 'spanish' | 'french',  // etc.
    ranking: 'default' | 'custom',
  },
  
  // Elasticsearch
  elasticsearch?: {
    host: string,
    index: string,
    shards: number,
    replicas: number,
  },
  
  // Meilisearch
  meilisearch?: {
    host: string,
    apiKey: string,
    index: string,
  },
  
  // Algolia
  algolia?: {
    appId: string,
    apiKey: string,
    indexName: string,
  },
}

// Search service
class SearchService {
  // Index document
  async index(collection: string, document: any): Promise<void> {
    const searchableFields = this.getSearchableFields(collection)
    const searchData = this.extractSearchData(document, searchableFields)
    
    await this.engine.index({
      id: document.id,
      collection,
      ...searchData,
    })
  }
  
  // Search
  async search(query: string, options?: SearchOptions): Promise<SearchResults> {
    return await this.engine.search(query, {
      collections: options?.collections,
      filters: options?.filters,
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      facets: options?.facets,
      sort: options?.sort,
    })
  }
  
  // Autocomplete
  async autocomplete(query: string, limit = 5): Promise<string[]> {
    return await this.engine.autocomplete(query, limit)
  }
  
  // Suggest
  async suggest(query: string): Promise<Suggestion[]> {
    return await this.engine.suggest(query)
  }
}
```

### 30.2 Collection Search Configuration

```typescript
// Configure search for collections
interface CollectionConfig {
  slug: string,
  fields: Field[],
  
  // Search configuration
  search?: {
    enabled: boolean,
    
    // Searchable fields
    searchableFields: Array<{
      field: string,
      weight: number,      // Boost factor
      exact: boolean,      // Exact match priority
    }>,
    
    // Filterable fields
    filterableFields: string[],
    
    // Sortable fields
    sortableFields: string[],
    
    // Facets
    facets: string[],
    
    // Ranking
    ranking?: {
      // Custom ranking rules
      rules: Array<{
        field: string,
        order: 'asc' | 'desc',
      }>,
    },
  },
}

// Example: Blog posts search
const postsCollection = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'content', type: 'richText' },
    { name: 'excerpt', type: 'textarea' },
    { name: 'author', type: 'relationship' },
    { name: 'category', type: 'relationship' },
    { name: 'tags', type: 'array' },
    { name: 'publishedAt', type: 'date' },
  ],
  
  search: {
    enabled: true,
    
    searchableFields: [
      { field: 'title', weight: 3, exact: true },
      { field: 'excerpt', weight: 2, exact: false },
      { field: 'content', weight: 1, exact: false },
    ],
    
    filterableFields: ['author', 'category', 'tags', 'publishedAt'],
    sortableFields: ['publishedAt', 'title'],
    facets: ['category', 'tags', 'author'],
    
    ranking: {
      rules: [
        { field: 'publishedAt', order: 'desc' },
      ],
    },
  },
}
```

### 30.3 Search API

```typescript
// REST API: Search endpoint
GET /api/search?q=query&collections=posts,products&filters[category]=tech

interface SearchEndpoint {
  // Search across all collections
  'GET /api/search': {
    query: {
      q: string,                    // Search query
      collections?: string[],       // Limit to collections
      filters?: Record<string, any>, // Filters
      facets?: string[],            // Return facets
      limit?: number,               // Results per page
      offset?: number,              // Pagination
      sort?: string,                // Sort field
    },
    response: {
      hits: SearchHit[],
      facets: Record<string, Facet[]>,
      total: number,
      processingTime: number,
    },
  },
  
  // Autocomplete
  'GET /api/search/autocomplete': {
    query: {
      q: string,
      limit?: number,
    },
    response: {
      suggestions: string[],
    },
  },
}

// GraphQL API: Search
query SearchPosts {
  search(
    query: "typescript framework"
    collections: ["posts"]
    filters: { category: "tech" }
    limit: 10
  ) {
    hits {
      id
      collection
      title
      excerpt
      score
    }
    total
    facets {
      category {
        value
        count
      }
    }
  }
}
```

### 30.4 Frontend Search Components

```typescript
// Template-based search configuration
interface SearchTemplate {
  // Search input configuration
  searchBox: {
    type: 'search',
    placeholder: 'Search...',
    dataSource: 'api.search',
    showLoading: true,
    minCharacters: 2,
    debounce: 300,  // ms
  },
  
  // Search result template
  resultTemplate: {
    type: 'link',
    href: '{hit.url}',
    fields: [
      {
        type: 'heading',
        level: 3,
        value: '{hit.title}',
      },
      {
        type: 'text',
        value: '{hit.excerpt}',
      },
      {
        type: 'metadata',
        fields: [
          { label: 'Collection', value: '{hit.collection}' },
          { label: 'Date', value: '{hit.publishedAt}', format: 'date' },
        ],
      },
    ],
  },
  
  // Autocomplete configuration
  autocomplete: {
    enabled: true,
    dataSource: 'api.search.autocomplete',
    maxSuggestions: 5,
    onSelect: {
      action: 'navigate',
      target: '/search?q={value}',
    },
  },
}
```

### 30.5 Plugin Search Integration

```typescript
// Plugins can add searchable content
export const myPlugin: FromcodePlugin = () => ({
  name: 'my-plugin',
  
  collections: [
    {
      slug: 'my-documents',
      fields: [/* ... */],
      
      // Enable search
      search: {
        enabled: true,
        searchableFields: [
          { field: 'title', weight: 3 },
          { field: 'body', weight: 1 },
        ],
      },
    },
  ],
  
  // Hooks: Index on create/update
  hooks: [
    {
      collection: 'my-documents',
      hook: 'afterChange',
      handler: async (doc, ctx) => {
        // Automatically indexed by framework
        await ctx.search.index('my-documents', doc)
      },
    },
    {
      collection: 'my-documents',
      hook: 'afterDelete',
      handler: async (doc, ctx) => {
        // Remove from search index
        await ctx.search.delete('my-documents', doc.id)
      },
    },
  ],
})
```

---

## 31. Background Tasks & Cron Jobs

### 31.1 Job Queue System

```typescript
// Background job processing
interface JobQueueConfig {
  // Queue backend
  driver: 'redis' | 'database' | 'memory',
  
  // Redis configuration (recommended)
  redis?: {
    host: string,
    port: number,
    password?: string,
  },
  
  // Job queues
  queues: {
    [queueName: string]: {
      concurrency: number,      // Parallel jobs
      rateLimit?: {
        max: number,            // Max jobs per duration
        duration: number,       // Duration in ms
      },
      priority: number,         // Queue priority
      retry: {
        attempts: number,
        backoff: 'fixed' | 'exponential',
        delay: number,
      },
    },
  },
}

// Define job
interface Job<T = any> {
  id: string,
  queue: string,
  data: T,
  priority?: number,
  delay?: number,              // Delay before processing (ms)
  repeat?: {
    cron?: string,             // Cron expression
    every?: number,            // Interval in ms
    limit?: number,            // Max repetitions
  },
  attempts: number,
  processedAt?: number,
  completedAt?: number,
  failedAt?: number,
  error?: string,
}

// Job processor
import { Queue, Worker } from 'bullmq'

class JobQueue {
  private queues = new Map<string, Queue>()
  private workers = new Map<string, Worker>()
  
  // Add job to queue
  async add<T>(
    queue: string,
    data: T,
    options?: JobOptions
  ): Promise<Job<T>> {
    const q = this.getQueue(queue)
    
    return await q.add(queue, data, {
      priority: options?.priority,
      delay: options?.delay,
      repeat: options?.repeat,
      attempts: options?.attempts || 3,
      backoff: options?.backoff,
    })
  }
  
  // Process jobs
  process(
    queue: string,
    handler: (job: Job) => Promise<any>
  ): void {
    const worker = new Worker(queue, async (job) => {
      try {
        const result = await handler(job)
        return result
      } catch (error) {
        // Log error
        console.error(`[Job] Failed: ${queue}`, error)
        throw error
      }
    }, {
      connection: this.redisConnection,
      concurrency: this.config.queues[queue]?.concurrency || 1,
    })
    
    this.workers.set(queue, worker)
  }
}
```

### 31.2 Cron Jobs

```typescript
// Cron job scheduler
import { CronJob } from 'cron'

interface CronJobConfig {
  name: string,
  schedule: string,            // Cron expression
  handler: () => Promise<void>,
  timezone?: string,
  enabled: boolean,
}

class CronScheduler {
  private jobs = new Map<string, CronJob>()
  
  // Register cron job
  register(config: CronJobConfig): void {
    const job = new CronJob(
      config.schedule,
      async () => {
        try {
          await config.handler()
        } catch (error) {
          console.error(`[Cron] Job ${config.name} failed:`, error)
        }
      },
      null,
      config.enabled,
      config.timezone
    )
    
    this.jobs.set(config.name, job)
    
    if (config.enabled) {
      job.start()
    }
  }
  
  // Start job
  start(name: string): void {
    this.jobs.get(name)?.start()
  }
  
  // Stop job
  stop(name: string): void {
    this.jobs.get(name)?.stop()
  }
}

// Common cron expressions
const CRON_EXPRESSIONS = {
  EVERY_MINUTE: '* * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_HOUR: '0 * * * *',
  EVERY_DAY_MIDNIGHT: '0 0 * * *',
  EVERY_WEEK_SUNDAY: '0 0 * * 0',
  EVERY_MONTH_FIRST: '0 0 1 * *',
}
```

### 31.3 Plugin Background Tasks

```typescript
// Plugins can register background jobs
export const myPlugin: FromcodePlugin = () => ({
  name: 'my-plugin',
  
  // Define job processors
  jobs: [
    {
      queue: 'email',
      handler: async (job, ctx) => {
        const { to, subject, body } = job.data
        await ctx.email.send({ to, subject, body })
      },
    },
    {
      queue: 'image-processing',
      handler: async (job, ctx) => {
        const { imageId } = job.data
        await processImage(imageId)
      },
    },
  ],
  
  // Define cron jobs
  cron: [
    {
      name: 'daily-cleanup',
      schedule: '0 0 * * *',  // Midnight daily
      handler: async (ctx) => {
        await cleanupOldRecords()
      },
    },
    {
      name: 'hourly-sync',
      schedule: '0 * * * *',  // Every hour
      handler: async (ctx) => {
        await syncWithExternalAPI()
      },
    },
  ],
  
  // Enqueue jobs from endpoints
  endpoints: [{
    path: '/send-email',
    method: 'post',
    handler: async (req, res, ctx) => {
      // Add job to queue instead of processing immediately
      await ctx.jobs.add('email', {
        to: req.body.to,
        subject: req.body.subject,
        body: req.body.body,
      })
      
      res.json({ message: 'Email queued' })
    },
  }],
})
```

### 31.4 Job Monitoring & Management

```typescript
// Admin panel: Job queue management
interface JobMonitoring {
  // View queue stats
  getQueueStats(queue: string): QueueStats,
  
  // View jobs
  listJobs(queue: string, status: JobStatus): Job[],
  
  // Retry failed job
  retryJob(jobId: string): Promise<void>,
  
  // Remove job
  removeJob(jobId: string): Promise<void>,
  
  // Pause/resume queue
  pauseQueue(queue: string): Promise<void>,
  resumeQueue(queue: string): Promise<void>,
  
  // Clear queue
  clearQueue(queue: string, status?: JobStatus): Promise<void>,
}

interface QueueStats {
  waiting: number,
  active: number,
  completed: number,
  failed: number,
  delayed: number,
  paused: boolean,
}

// Template-based dashboard configuration
interface JobQueueDashboardTemplate {
  layout: {
    type: 'dashboard',
    title: 'Background Jobs',
  },
  
  // Queue card template
  queueCard: {
    dataSource: 'api.jobs.queues',
    itemTemplate: {
      title: '{queue.name}',
      
      stats: [
        { label: 'Waiting', value: '{queue.stats.waiting}' },
        { label: 'Active', value: '{queue.stats.active}' },
        { label: 'Completed', value: '{queue.stats.completed}' },
        { label: 'Failed', value: '{queue.stats.failed}', color: 'red' },
      ],
      
      actions: [
        {
          label: 'View Failed',
          action: 'viewJobs',
          params: { queue: '{queue.name}', status: 'failed' },
        },
        {
          label: 'Retry All Failed',
          action: 'retryAll',
          params: { queue: '{queue.name}' },
        },
        {
          label: '{queue.stats.paused ? "Resume" : "Pause"}',
          action: '{queue.stats.paused ? "resumeQueue" : "pauseQueue"}',
          params: { queue: '{queue.name}' },
        },
      ],
    },
  },
}
```

### 31.5 CLI Commands

```bash
# View queue stats
fromcode jobs:stats

# View jobs in queue
fromcode jobs:list email --status=failed

# Retry failed jobs
fromcode jobs:retry email --all

# Clear queue
fromcode jobs:clear email --status=completed

# Run cron job manually
fromcode cron:run daily-cleanup

# List cron jobs
fromcode cron:list
```

---

## 32. Plugin Versioning & Updates

### 32.1 Semantic Versioning

```typescript
// Strict semver enforcement
interface VersionManagement {
  // Version format: MAJOR.MINOR.PATCH
  // 1.0.0 → 1.0.1 (patch: bug fixes)
  // 1.0.0 → 1.1.0 (minor: new features, backwards compatible)
  // 1.0.0 → 2.0.0 (major: breaking changes)
  
  version: string,  // Current version
  
  // Compatibility check
  isCompatible(required: string, installed: string): boolean {
    const req = this.parseVersion(required)
    const inst = this.parseVersion(installed)
    
    // Major version must match
    if (req.major !== inst.major) {
      return false
    }
    
    // Minor version must be >= required
    if (inst.minor < req.minor) {
      return false
    }
    
    // Patch version doesn't matter for compatibility
    return true
  },
}

// Plugin manifest versioning
interface PluginManifest {
  version: string,  // Plugin version
  
  // Framework compatibility
  framework: {
    min: string,    // Minimum framework version
    max?: string,   // Maximum framework version (optional)
  },
  
  // Plugin dependencies
  dependencies: {
    [pluginSlug: string]: string,  // Semver range
  },
  
  // Changelog
  changelog: {
    [version: string]: {
      date: string,
      changes: string[],
      breaking?: string[],
    },
  },
}

// Example
{
  "name": "My Plugin",
  "slug": "my-plugin",
  "version": "2.1.3",
  
  "framework": {
    "min": "1.0.0",
    "max": "2.x.x"
  },
  
  "dependencies": {
    "cms": "^1.2.0",      // 1.2.0 ≤ version < 2.0.0
    "auth": "~1.5.0"      // 1.5.0 ≤ version < 1.6.0
  },
  
  "changelog": {
    "2.1.3": {
      "date": "2024-01-15",
      "changes": [
        "Fixed memory leak in event handler",
        "Improved error messages"
      ]
    },
    "2.1.0": {
      "date": "2024-01-01",
      "changes": [
        "Added webhook support",
        "New API endpoint /export"
      ]
    },
    "2.0.0": {
      "date": "2023-12-01",
      "changes": [
        "Complete rewrite with new architecture"
      ],
      "breaking": [
        "Removed deprecated API endpoints",
        "Changed configuration format"
      ]
    }
  }
}
```

### 32.2 Update System

```typescript
// Plugin update manager
class PluginUpdateManager {
  // Check for updates
  async checkUpdates(plugin: Plugin): Promise<Update | null> {
    const latest = await marketplace.getLatestVersion(plugin.slug)
    
    if (this.isNewer(latest.version, plugin.version)) {
      return {
        plugin: plugin.slug,
        current: plugin.version,
        latest: latest.version,
        changelog: latest.changelog,
        breaking: latest.breaking || false,
        compatible: this.isCompatible(latest, plugin),
      }
    }
    
    return null
  }
  
  // Update plugin
  async update(plugin: Plugin, version?: string): Promise<void> {
    const targetVersion = version || await this.getLatestVersion(plugin.slug)
    
    // 1. Check compatibility
    const compatible = await this.checkCompatibility(plugin, targetVersion)
    if (!compatible) {
      throw new Error('Incompatible version')
    }
    
    // 2. Create backup
    await this.createBackup(plugin)
    
    // 3. Download new version
    const newPackage = await marketplace.download(plugin.slug, targetVersion)
    
    // 4. Verify signature
    await this.verifyPackage(newPackage)
    
    // 5. Run migrations
    await this.runMigrations(plugin, targetVersion)
    
    // 6. Replace plugin files
    await this.replaceFiles(plugin, newPackage)
    
    // 7. Reload plugin
    await pluginLoader.reload(plugin.slug)
    
    // 8. Verify health
    const healthy = await this.verifyHealth(plugin)
    if (!healthy) {
      // Rollback
      await this.rollback(plugin)
      throw new Error('Update failed health check')
    }
    
    // 9. Cleanup backup
    await this.cleanupBackup(plugin)
  }
  
  // Rollback update
  async rollback(plugin: Plugin): Promise<void> {
    const backup = await this.getLatestBackup(plugin)
    await this.restoreBackup(plugin, backup)
    await pluginLoader.reload(plugin.slug)
  }
}
```

### 32.3 Breaking Changes Migration

```typescript
// Migration system for breaking changes
interface PluginMigration {
  version: string,           // Target version
  breaking: boolean,         // Is breaking change?
  
  // Migration script
  up: (ctx: MigrationContext) => Promise<void>,
  
  // Rollback script
  down: (ctx: MigrationContext) => Promise<void>,
  
  // Pre-migration checks
  validate?: (ctx: MigrationContext) => Promise<boolean>,
}

// Example: v2.0.0 breaking change
const migration_2_0_0: PluginMigration = {
  version: '2.0.0',
  breaking: true,
  
  // Check if migration can run
  validate: async (ctx) => {
    // Check if old config format exists
    const config = await ctx.db.findOne('plugin-config', {
      plugin: ctx.plugin.slug,
    })
    
    return config?.version === '1.x.x'
  },
  
  // Migrate data
  up: async (ctx) => {
    // Convert old config format to new format
    const oldConfig = await ctx.db.findOne('plugin-config', {
      plugin: ctx.plugin.slug,
    })
    
    const newConfig = {
      ...oldConfig,
      // Transform old format to new
      settings: transformSettings(oldConfig.settings),
      version: '2.0.0',
    }
    
    await ctx.db.update('plugin-config', oldConfig.id, newConfig)
    
    // Migrate user data
    const users = await ctx.db.find('users', {})
    for (const user of users) {
      if (user.pluginData?.[ctx.plugin.slug]) {
        user.pluginData[ctx.plugin.slug] = transformUserData(
          user.pluginData[ctx.plugin.slug]
        )
        await ctx.db.update('users', user.id, user)
      }
    }
  },
  
  // Rollback migration
  down: async (ctx) => {
    // Revert to old format
    const newConfig = await ctx.db.findOne('plugin-config', {
      plugin: ctx.plugin.slug,
    })
    
    const oldConfig = {
      ...newConfig,
      settings: revertSettings(newConfig.settings),
      version: '1.x.x',
    }
    
    await ctx.db.update('plugin-config', newConfig.id, oldConfig)
  },
}
```

### 32.4 Update UI

```typescript
// Template-based updates page configuration
interface PluginUpdatesTemplate {
  layout: {
    type: 'page',
    title: 'Plugin Updates',
  },
  
  // Empty state
  emptyState: {
    message: 'All plugins are up to date!',
  },
  
  // Update card template
  updateCard: {
    dataSource: 'api.plugins.updates',
    itemTemplate: {
      header: {
        title: '{update.plugin}',
        badge: {
          show: '{update.breaking}',
          label: 'Breaking Changes',
          color: 'red',
        },
      },
      
      versionInfo: {
        current: '{update.current}',
        latest: '{update.latest}',
        format: 'Current: {current} → Latest: {latest}',
      },
      
      changelog: {
        title: "What's New:",
        items: '{update.changelog}',
        
        breakingChanges: {
          show: '{update.breaking}',
          title: 'Breaking Changes:',
          items: '{update.breakingChanges}',
          style: 'warning',
        },
      },
      
      actions: [
        {
          label: '{updating === update.plugin ? "Updating..." : "Update"}',
          action: 'updatePlugin',
          params: { plugin: '{update.plugin}' },
          disabled: '{updating === update.plugin}',
        },
      ],
    },
  },
  
  // Global actions
  globalActions: [
    {
      label: 'Update All',
      action: 'updateAll',
    },
  ],
}
```

### 32.5 Automatic Updates

```typescript
// Optional: Automatic updates configuration
interface AutoUpdateConfig {
  enabled: boolean,
  
  // What to auto-update
  security: boolean,         // Security patches (recommended)
  patches: boolean,          // Bug fixes (1.0.0 → 1.0.1)
  minor: boolean,            // New features (1.0.0 → 1.1.0)
  major: boolean,            // Breaking changes (1.0.0 → 2.0.0) - not recommended
  
  // When to auto-update
  schedule: 'immediately' | 'daily' | 'weekly' | 'monthly',
  
  // Notifications
  notify: {
    before: boolean,         // Notify before update
    after: boolean,          // Notify after update
    failed: boolean,         // Notify on failure
  },
  
  // Rollback
  autoRollback: boolean,     // Rollback if update fails
  
  // Testing
  testFirst: boolean,        // Test on staging first
}

// Auto-update job (cron)
const autoUpdateJob = {
  name: 'auto-update-plugins',
  schedule: '0 2 * * *',  // 2 AM daily
  
  handler: async () => {
    const config = await getAutoUpdateConfig()
    
    if (!config.enabled) return
    
    const plugins = await getInstalledPlugins()
    
    for (const plugin of plugins) {
      const update = await checkUpdate(plugin)
      
      if (!update) continue
      
      // Check if should auto-update
      if (shouldAutoUpdate(update, config)) {
        try {
          await updatePlugin(plugin, update.latest)
          
          if (config.notify.after) {
            await notifyAdmin({
              subject: `Plugin ${plugin.name} updated`,
              message: `Successfully updated to ${update.latest}`,
            })
          }
        } catch (error) {
          if (config.autoRollback) {
            await rollbackPlugin(plugin)
          }
          
          if (config.notify.failed) {
            await notifyAdmin({
              subject: `Plugin ${plugin.name} update failed`,
              message: error.message,
            })
          }
        }
      }
    }
  },
}
```

---

## 33. Documentation Standards

### 33.1 Plugin Documentation Requirements

```typescript
// Required documentation for marketplace plugins
interface PluginDocumentation {
  // README.md (required)
  readme: {
    title: string,
    description: string,
    installation: string,
    usage: string,
    configuration: string,
    examples: string[],
    troubleshooting: string,
    changelog: string,
    license: string,
  },
  
  // API documentation (required if plugin exposes API)
  api?: {
    endpoints: EndpointDoc[],
    hooks: HookDoc[],
    types: TypeDoc[],
  },
  
  // User guide (recommended)
  guide?: {
    gettingStarted: string,
    tutorials: Tutorial[],
    recipes: Recipe[],
  },
  
  // Developer docs (required for complex plugins)
  developer?: {
    architecture: string,
    contributing: string,
    testing: string,
  },
}

// Documentation template
const README_TEMPLATE = `
# {Plugin Name}

{Short description}

## Installation

\`\`\`bash
fromcode plugin install {plugin-slug}
\`\`\`

## Features

- Feature 1
- Feature 2
- Feature 3

## Usage

### Basic Usage

\`\`\`typescript
// Example code
\`\`\`

### Advanced Usage

\`\`\`typescript
// Advanced example
\`\`\`

## Configuration

\`\`\`typescript
// Configuration options
\`\`\`

## API Reference

### Endpoints

#### GET /api/endpoint

Description of endpoint

**Parameters:**
- \`param1\` (string) - Description
- \`param2\` (number, optional) - Description

**Response:**
\`\`\`json
{
  "data": "example"
}
\`\`\`

### Hooks

#### hook-name

Description of hook

**Parameters:**
- \`param1\` - Description

**Example:**
\`\`\`typescript
ctx.hooks.on('hook-name', (param1) => {
  // Handle event
})
\`\`\`

## Troubleshooting

### Issue 1

**Problem:** Description
**Solution:** Solution steps

### Issue 2

**Problem:** Description
**Solution:** Solution steps

## Changelog

See [CHANGELOG.md](CHANGELOG.md)

## License

{License}

## Support

- **Documentation:** https://docs.fromcode.io/plugins/{plugin-slug}
- **Issues:** https://github.com/{org}/{repo}/issues
- **Email:** {support-email}
`
```

### 33.2 Code Documentation

```typescript
// TSDoc comments for all public APIs
/**
 * Plugin public API
 * 
 * @example
 * ```typescript
 * const myPlugin = fromcode.plugins.get('my-plugin')
 * await myPlugin.doSomething()
 * ```
 */
export interface PluginAPI {
  /**
   * Do something useful
   * 
   * @param input - Input parameter
   * @param options - Optional configuration
   * @returns Promise resolving to result
   * 
   * @throws {ValidationError} If input is invalid
   * @throws {PermissionError} If user lacks permissions
   * 
   * @example
   * ```typescript
   * await plugin.doSomething('input', {
   *   option1: true
   * })
   * ```
   */
  doSomething(
    input: string,
    options?: DoSomethingOptions
  ): Promise<Result>
}

/**
 * Options for doSomething method
 */
export interface DoSomethingOptions {
  /**
   * Enable feature X
   * @default false
   */
  option1?: boolean
  
  /**
   * Timeout in milliseconds
   * @default 5000
   */
  timeout?: number
}
```

### 33.3 Interactive Documentation

```typescript
// Template-based API explorer configuration
interface APIExplorerTemplate {
  layout: {
    type: 'explorer',
    title: 'API Explorer - {plugin.name}',
  },
  
  // Endpoint selector
  endpointSelector: {
    type: 'dropdown',
    placeholder: 'Select endpoint',
    dataSource: 'plugin.endpoints',
    labelFormat: '{endpoint.method.toUpperCase()} {endpoint.path}',
    valueField: 'path',
  },
  
  // Endpoint documentation template
  endpointDocs: {
    show: '{endpoint !== null}',
    
    header: {
      method: '{endpoint.method.toUpperCase()}',
      path: '{endpoint.path}',
      description: '{endpoint.description}',
    },
    
    parameters: {
      title: 'Parameters',
      dataSource: '{endpoint.params}',
      
      parameterField: {
        label: '{param.name}',
        type: '{param.type}',
        placeholder: '{param.description}',
        required: '{param.required}',
      },
    },
    
    actions: [
      {
        label: 'Try It',
        action: 'executeRequest',
        params: { endpoint: '{endpoint}', values: '{formValues}' },
      },
    ],
  },
  
  // Response display
  responseDisplay: {
    show: '{response !== null}',
    title: 'Response',
    format: 'json',
    value: '{response}',
    syntax: 'highlight',
  },
}
```

### 33.4 Documentation Generator

```bash
# Generate documentation from code
fromcode docs:generate my-plugin

# Output:
# ✓ Generated API documentation
# ✓ Generated type definitions
# ✓ Generated examples
# ✓ Generated README sections
#
# Docs saved to: docs/plugins/my-plugin/

# Publish documentation
fromcode docs:publish my-plugin

# Output:
# ✓ Published to https://docs.fromcode.io/plugins/my-plugin
```

---

## 34. Legal & Compliance

### 34.1 GDPR Compliance

```typescript
// Built-in GDPR compliance features
interface GDPRCompliance {
  // Data subject rights
  rights: {
    // Right to access
    exportData: (userId: string) => Promise<UserData>,
    
    // Right to erasure
    deleteData: (userId: string) => Promise<void>,
    
    // Right to rectification
    updateData: (userId: string, data: Partial<UserData>) => Promise<void>,
    
    // Right to restrict processing
    restrictProcessing: (userId: string) => Promise<void>,
    
    // Right to data portability
    exportPortable: (userId: string, format: 'json' | 'xml' | 'csv') => Promise<File>,
  },
  
  // Consent management
  consent: {
    // Track consent
    record: (userId: string, purpose: string, granted: boolean) => Promise<void>,
    
    // Check consent
    hasConsent: (userId: string, purpose: string) => Promise<boolean>,
    
    // Withdraw consent
    withdraw: (userId: string, purpose: string) => Promise<void>,
  },
  
  // Data retention
  retention: {
    // Retention policies
    policies: Array<{
      dataType: string,
      retentionPeriod: number,  // Days
      deletionMethod: 'soft' | 'hard',
    }>,
    
    // Cleanup job
    cleanup: () => Promise<void>,
  },
  
  // Audit logging
  audit: {
    // Log data access
    logAccess: (userId: string, dataType: string, action: string) => Promise<void>,
    
    // Get audit trail
    getTrail: (userId: string) => Promise<AuditEntry[]>,
  },
}

// Plugin GDPR hooks
export const myPlugin: FromcodePlugin = () => ({
  name: 'my-plugin',
  
  // Handle data export
  gdpr: {
    exportData: async (userId, ctx) => {
      // Return all user data from this plugin
      return {
        orders: await ctx.db.find('orders', { userId }),
        preferences: await ctx.db.findOne('preferences', { userId }),
      }
    },
    
    // Handle data deletion
    deleteData: async (userId, ctx) => {
      // Delete all user data from this plugin
      await ctx.db.delete('orders', { userId })
      await ctx.db.delete('preferences', { userId })
    },
  },
})
```

### 34.2 License Management

```typescript
// Plugin licensing
interface PluginLicense {
  type: 'MIT' | 'GPL' | 'Apache' | 'Proprietary' | 'Commercial',
  
  // Commercial licensing
  commercial?: {
    pricing: {
      type: 'free' | 'one-time' | 'subscription',
      price?: number,
      currency?: string,
      interval?: 'month' | 'year',
    },
    
    // License activation
    requiresLicense: boolean,
    
    // License verification
    verifyLicense: (key: string) => Promise<boolean>,
    
    // Trial period
    trial?: {
      duration: number,  // Days
      features: string[],
    },
  },
  
  // Usage restrictions
  restrictions?: {
    domains?: string[],      // Domain whitelist
    seats?: number,          // Number of users
    installations?: number,  // Number of installations
  },
}

// License verification
class LicenseManager {
  async verifyLicense(plugin: Plugin, key: string): Promise<boolean> {
    // Call licensing server
    const response = await fetch('https://licenses.fromcode.io/verify', {
      method: 'POST',
      body: JSON.stringify({
        plugin: plugin.slug,
        key,
        domain: process.env.DOMAIN,
      }),
    })
    
    const result = await response.json()
    
    if (result.valid) {
      // Store license
      await this.storeLicense(plugin, key, result)
      return true
    }
    
    return false
  }
}
```

### 34.3 Terms of Service & Privacy Policy

```typescript
// Built-in legal pages
interface LegalPages {
  // Terms of Service
  terms: {
    content: string,
    version: string,
    lastUpdated: Date,
    acceptanceRequired: boolean,
  },
  
  // Privacy Policy
  privacy: {
    content: string,
    version: string,
    lastUpdated: Date,
    
    // Data collection disclosure
    dataCollection: Array<{
      type: string,
      purpose: string,
      retention: string,
      thirdParties?: string[],
    }>,
  },
  
  // Cookie Policy
  cookies: {
    content: string,
    
    // Cookie categories
    categories: Array<{
      name: string,
      description: string,
      cookies: Array<{
        name: string,
        purpose: string,
        duration: string,
      }>,
    }>,
  },
}

// Accept terms
async function acceptTerms(userId: string, version: string): Promise<void> {
  await db.create('terms-acceptance', {
    userId,
    version,
    acceptedAt: new Date(),
    ipAddress: req.ip,
  })
}

// Check if user accepted latest terms
async function hasAcceptedLatestTerms(userId: string): Promise<boolean> {
  const latestVersion = await getLatestTermsVersion()
  const acceptance = await db.findOne('terms-acceptance', {
    userId,
    version: latestVersion,
  })
  
  return !!acceptance
}
```

### 34.4 Security Compliance

```typescript
// Security certifications & compliance
interface SecurityCompliance {
  // SOC 2 Type II
  soc2: {
    certified: boolean,
    auditDate: Date,
    controls: string[],
  },
  
  // ISO 27001
  iso27001: {
    certified: boolean,
    certificateNumber: string,
  },
  
  // PCI DSS (for e-commerce)
  pci: {
    level: 1 | 2 | 3 | 4,
    compliant: boolean,
    scanDate: Date,
  },
  
  // HIPAA (for healthcare)
  hipaa: {
    compliant: boolean,
    baa: boolean,  // Business Associate Agreement
  },
}
```

---

## 35. Performance Optimization

### 35.1 Caching Strategies

```typescript
// Multi-layer caching
interface CachingStrategy {
  // L1: Memory cache (fastest)
  memory: {
    enabled: boolean,
    maxSize: number,  // MB
    ttl: number,      // Seconds
  },
  
  // L2: Redis cache (fast)
  redis: {
    enabled: boolean,
    ttl: number,
  },
  
  // L3: CDN cache (for static assets)
  cdn: {
    enabled: boolean,
    provider: 'cloudflare' | 'fastly' | 'cloudfront',
    ttl: number,
  },
  
  // Cache invalidation
  invalidation: {
    strategy: 'time-based' | 'event-based' | 'manual',
    events: string[],  // Events that trigger invalidation
  },
}

// Smart caching decorator
function cached(options: CacheOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = generateCacheKey(propertyKey, args)
      
      // Check cache
      const cached = await cache.get(cacheKey)
      if (cached) {
        return cached
      }
      
      // Execute method
      const result = await originalMethod.apply(this, args)
      
      // Store in cache
      await cache.set(cacheKey, result, options.ttl)
      
      return result
    }
    
    return descriptor
  }
}

// Usage
class PostService {
  @cached({ ttl: 3600 })
  async getPost(id: string) {
    return await db.findOne('posts', { id })
  }
}
```

### 35.2 Database Optimization

```typescript
// Database performance optimization
interface DatabaseOptimization {
  // Connection pooling
  pool: {
    min: number,
    max: number,
    idleTimeout: number,
  },
  
  // Query optimization
  queries: {
    // Prepare statements
    prepareStatements: boolean,
    
    // Batch operations
    batchSize: number,
    
    // Select only needed fields
    selectFields: string[],
    
    // Use indexes
    indexes: Array<{
      collection: string,
      fields: string[],
      unique?: boolean,
    }>,
  },
  
  // Read replicas
  replication: {
    enabled: boolean,
    readReplicas: string[],
    writeUrl: string,
  },
}

// N+1 query prevention
// ❌ Bad: N+1 queries
for (const post of posts) {
  const author = await db.findOne('users', { id: post.authorId })
  post.author = author
}

// ✅ Good: Single query with join
const postsWithAuthors = await db.find('posts', {
  populate: ['author'],
})
```

### 35.3 Frontend Performance

```typescript
// Frontend optimization
interface FrontendOptimization {
  // Code splitting
  codeSplitting: {
    enabled: boolean,
    strategy: 'route' | 'component' | 'manual',
  },
  
  // Lazy loading
  lazyLoading: {
    images: boolean,
    components: boolean,
    routes: boolean,
  },
  
  // Bundle optimization
  bundling: {
    minify: boolean,
    treeshaking: boolean,
    compression: 'gzip' | 'brotli',
  },
  
  // Asset optimization
  assets: {
    // Image optimization
    images: {
      formats: ['webp', 'avif'],
      responsive: boolean,
      lazy: boolean,
    },
    
    // Font optimization
    fonts: {
      preload: boolean,
      display: 'swap' | 'fallback' | 'optional',
    },
  },
}

// React performance
// Use React.memo for expensive components
export const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* Heavy rendering */}</div>
})

// Use useMemo for expensive calculations
function MyComponent({ items }) {
  const sortedItems = useMemo(() => {
    return items.sort((a, b) => a.value - b.value)
  }, [items])
  
  return <List items={sortedItems} />
}

// Use useCallback for event handlers
function MyComponent() {
  const handleClick = useCallback(() => {
    // Handle click
  }, [])
  
  return <Button onClick={handleClick} />
}
```

### 35.4 Plugin Load Time Optimization

```typescript
// Optimize plugin loading
interface PluginLoadOptimization {
  // Lazy loading
  lazyLoad: {
    enabled: boolean,
    // Load plugins only when needed
    loadOnDemand: boolean,
  },
  
  // Parallel loading
  parallel: {
    enabled: boolean,
    maxConcurrent: number,
  },
  
  // Preloading
  preload: {
    critical: string[],  // Load immediately
    high: string[],      // Load after critical
    low: string[],       // Load in background
  },
}

// Load plugins in stages
async function loadPlugins() {
  // Stage 1: Critical plugins (blocking)
  await Promise.all(
    criticalPlugins.map(plugin => loadPlugin(plugin))
  )
  
  // Stage 2: High priority (parallel, non-blocking)
  Promise.all(
    highPriorityPlugins.map(plugin => loadPlugin(plugin))
  ).then(() => {
    // Stage 3: Low priority (background)
    requestIdleCallback(() => {
      lowPriorityPlugins.forEach(plugin => loadPlugin(plugin))
    })
  })
}
```

---

## 36. Accessibility (a11y)

### 36.1 Accessibility Standards

```typescript
// WCAG 2.1 compliance
interface AccessibilityStandards {
  // Compliance level
  level: 'A' | 'AA' | 'AAA',  // Target: AA minimum
  
  // Guidelines
  guidelines: {
    // Perceivable
    perceivable: {
      textAlternatives: boolean,   // Alt text for images
      timeBasedMedia: boolean,     // Captions for videos
      adaptable: boolean,          // Semantic HTML
      distinguishable: boolean,    // Color contrast
    },
    
    // Operable
    operable: {
      keyboardAccessible: boolean, // Keyboard navigation
      enoughTime: boolean,         // No time limits
      seizures: boolean,           // No flashing content
      navigable: boolean,          // Skip links, headings
    },
    
    // Understandable
    understandable: {
      readable: boolean,           // Plain language
      predictable: boolean,        // Consistent navigation
      inputAssistance: boolean,    // Form labels, errors
    },
    
    // Robust
    robust: {
      compatible: boolean,         // Valid HTML, ARIA
    },
  },
}

// Accessibility checker
class AccessibilityChecker {
  async check(html: string): Promise<A11yReport> {
    const issues: A11yIssue[] = []
    
    // Check color contrast
    const contrastIssues = await this.checkContrast(html)
    issues.push(...contrastIssues)
    
    // Check alt text
    const altTextIssues = await this.checkAltText(html)
    issues.push(...altTextIssues)
    
    // Check keyboard navigation
    const keyboardIssues = await this.checkKeyboard(html)
    issues.push(...keyboardIssues)
    
    // Check ARIA
    const ariaIssues = await this.checkAria(html)
    issues.push(...ariaIssues)
    
    // Check semantic HTML
    const semanticIssues = await this.checkSemantic(html)
    issues.push(...semanticIssues)
    
    return {
      score: this.calculateScore(issues),
      issues,
      passed: issues.length === 0,
    }
  }
}
```

### 36.2 Accessible Components

```typescript
// Build accessible components by default
interface AccessibleComponent {
  // Keyboard navigation
  keyboard: {
    tabIndex: number,
    onKeyDown: (e: KeyboardEvent) => void,
    // Support arrow keys, enter, space, escape
  },
  
  // ARIA attributes
  aria: {
    role: string,
    label: string,
    describedBy?: string,
    expanded?: boolean,
    haspopup?: boolean,
    invalid?: boolean,
  },
  
  // Focus management
  focus: {
    focusable: boolean,
    focusVisible: boolean,
    trapFocus?: boolean,
  },
}

// Example: Accessible button
function AccessibleButton({ 
  children, 
  onClick,
  disabled,
  ariaLabel,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className="btn"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(e)
        }
      }}
    >
      {children}
    </button>
  )
}

// Example: Accessible modal
function AccessibleModal({ children, isOpen, onClose }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  
  // Focus trap
  useFocusTrap(modalRef, isOpen)
  
  // Close on Escape
  useKeyPress('Escape', onClose)
  
  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      hidden={!isOpen}
    >
      <h2 id="modal-title">Modal Title</h2>
      {children}
      <button onClick={onClose} aria-label="Close modal">
        ×
      </button>
    </div>
  )
}
```

### 36.3 Accessibility Testing

```bash
# Run accessibility audit
fromcode a11y:audit

# Output:
# ✓ Color contrast: PASS
# ✗ Alt text missing: 3 images
# ✗ Keyboard navigation: Skip link missing
# ✓ ARIA: PASS
# ✗ Form labels: 2 inputs without labels
#
# Score: 78/100 (AA partially compliant)

# Fix issues automatically
fromcode a11y:fix

# Output:
# ✓ Added alt text to images
# ✓ Added skip link
# ✓ Added form labels
#
# Rerun audit to verify fixes
```

### 36.4 Screen Reader Support

```typescript
// Screen reader announcements
function useAnnouncement() {
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div')
    announcement.setAttribute('role', 'status')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message
    
    document.body.appendChild(announcement)
    
    setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)
  }
  
  return { announce }
}

// Usage
function MyComponent() {
  const { announce } = useAnnouncement()
  
  const handleSave = async () => {
    await save()
    announce('Document saved successfully')
  }
  
  return <button onClick={handleSave}>Save</button>
}

// Visually hidden text for screen readers
const srOnly = css`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
`
```

---

## Conclusion

**You already have 80% of what you need!** Your current system has:
- ✓ Plugin architecture
- ✓ Plugin manager & loader
- ✓ Database abstraction
- ✓ Collection system
- ✓ Admin panel (needs redesign)
- ✓ 20+ plugins already built

**What's Missing:**
- [ ] Formal framework packaging (monorepo)
- [ ] CLI tool
- [ ] Plugin marketplace
- [ ] Developer documentation
- [ ] Marketing & branding

**This is DOABLE.** With focused effort, you can have a beta in 6 months and a v1.0 in 12 months.

**The WordPress of TypeScript is within reach. Let's build it!** 🚀

---

## Appendix A: Example Plugin Structure

```
plugins/ecommerce/
├── plugin.json              # Plugin manifest
├── index.ts                 # Backend entry point
│
├── collections/             # Database collections
│   ├── Products.ts
│   ├── Orders.ts
│   └── Customers.ts
│
├── endpoints/               # API endpoints
│   ├── checkout.ts
│   ├── payment.ts
│   └── shipping.ts
│
├── hooks/                   # Event hooks
│   ├── order-placed.ts
│   └── inventory-updated.ts
│
├── admin/                   # Admin panel extensions
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   └── OrderList.tsx
│   ├── routes/
│   │   └── index.ts
│   └── widgets/
│       └── SalesWidget.tsx
│
├── frontend/                # Frontend integration (served from plugin)
│   ├── index.ts             # Frontend entry point
│   ├── components/          # React components for slots
│   │   ├── ProductCard.tsx  # Component injected into slots
│   │   ├── CartWidget.tsx   # Widget component
│   │   ├── CheckoutFlow.tsx
│   │   └── OrderTracking.tsx
│   ├── pages/               # Full page overrides (optional)
│   │   ├── Shop.tsx         # Override /shop route
│   │   └── ProductDetail.tsx
│   ├── widgets/             # Reusable widgets
│   │   ├── MiniCart.tsx
│   │   └── ProductSearch.tsx
│   ├── overrides/           # Component overrides (optional)
│   │   └── Header.tsx       # Override core Header component
│   ├── styles/              # Plugin-specific styles
│   │   ├── main.css
│   │   └── components.css
│   ├── hooks/               # React hooks
│   │   ├── useCart.ts
│   │   └── useCheckout.ts
│   ├── lib/                 # Client-side utilities
│   │   ├── cart-utils.ts
│   │   └── price-formatter.ts
│   └── public/              # Static assets (served from /plugins/ecommerce/*)
│       ├── icons/
│       └── images/
│
├── migrations/              # Database migrations
│   └── 001_initial.ts
│
├── seeds/                   # Seed data
│   └── sample-products.ts
│
├── lib/                     # Backend utilities
│   ├── payment-processors/
│   └── shipping-providers/
│
├── types/                   # TypeScript types
│   └── index.ts
│
├── dist/                    # Built files (generated)
│   ├── backend/
│   │   └── index.js
│   └── frontend/            # Built frontend bundle
│       ├── index.js         # Bundled components
│       ├── styles.css       # Bundled styles
│       └── assets/          # Optimized assets
│
└── README.md                # Plugin documentation
```

### Plugin Frontend Structure Explained

```typescript
// plugins/ecommerce/frontend/index.ts
// This file is served from: /plugins/ecommerce/frontend/index.js

export const slots = {
  // Inject components into predefined slots
  'product.details.after': () => import('./components/ProductCard'),
  'layout.header.after': () => import('./widgets/MiniCart'),
}

export const widgets = {
  // Reusable widgets that can be called anywhere
  MiniCart: () => import('./widgets/MiniCart'),
  ProductSearch: () => import('./widgets/ProductSearch'),
}

export const overrides = {
  // Override core components (optional, use sparingly)
  'core/components/Header': () => import('./overrides/Header'),
  'core/pages/Home': () => import('./overrides/HomePage'),
}

export const routes = {
  // Full page routes managed by plugin
  '/shop': () => import('./pages/Shop'),
  '/shop/:slug': () => import('./pages/ProductDetail'),
  '/cart': () => import('./pages/Cart'),
  '/checkout': () => import('./pages/Checkout'),
}

// Styles are automatically loaded from plugin
// Served from: /plugins/ecommerce/frontend/styles.css
export const styles = [
  '/plugins/ecommerce/frontend/styles/main.css',
  '/plugins/ecommerce/frontend/styles/components.css',
]

// Client-side scripts
export const scripts = [
  {
    src: '/plugins/ecommerce/frontend/tracking.js',
    async: true,
  },
]

// Plugin initialization
export async function init() {
  console.log('[Ecommerce] Frontend initialized')
  
  // Initialize cart
  await initializeCart()
  
  // Listen to events from other plugins
  window.fromcode.on('user:login', syncCartWithUser)
}

// Public API for other plugins
export const api = {
  addToCart: (product: Product) => { /* ... */ },
  getCart: () => { /* ... */ },
  checkout: () => { /* ... */ },
}
```

### Using Plugin Widgets in Your App

```typescript
// In your main app (anywhere!)
import { Widget } from '@fromcode/core'

export default function MyPage() {
  return (
    <div>
      <h1>Welcome</h1>
      
      {/* Call plugin widget by name */}
      <Widget 
        plugin="ecommerce" 
        name="MiniCart" 
        props={{ showTotal: true }} 
      />
      
      {/* Multiple widgets from different plugins */}
      <div className="sidebar">
        <Widget plugin="ecommerce" name="ProductSearch" />
        <Widget plugin="cms" name="RecentPosts" />
        <Widget plugin="analytics" name="PopularContent" />
      </div>
    </div>
  )
}

// Or use the hook
import { useWidget } from '@fromcode/core'

function Header() {
  const MiniCart = useWidget('ecommerce', 'MiniCart')
  
  return (
    <header>
      <nav>...</nav>
      {MiniCart && <MiniCart showTotal={true} />}
    </header>
  )
}
```

### Component Override System

```typescript
// plugins/mytheme/frontend/overrides/Header.tsx
// Override the core Header component

import { CoreHeader } from '@fromcode/core/components/Header'

export default function CustomHeader(props) {
  // Extend or completely replace core component
  return (
    <div className="custom-header">
      {/* Use core component as base */}
      <CoreHeader {...props} />
      
      {/* Add custom elements */}
      <div className="custom-banner">
        Special Offer!
      </div>
    </div>
  )
}

// Or completely replace:
export default function CustomHeader(props) {
  return (
    <header className="my-custom-header">
      {/* Completely custom implementation */}
      <Logo />
      <Navigation />
      <Widget plugin="ecommerce" name="MiniCart" />
    </header>
  )
}
```

### Key Points

1. **All assets served from plugin directory**: 
   - `/plugins/ecommerce/frontend/styles.css`
   - `/plugins/ecommerce/frontend/tracking.js`
   - NOT from core, each plugin is self-contained

2. **Widgets are reusable**:
   - Defined in plugin's frontend
   - Can be called from anywhere using `<Widget>` component
   - Props passed dynamically

3. **Overrides are optional**:
   - Use sparingly to avoid conflicts
   - Can extend or replace core components
   - Theme plugins typically use this feature

4. **Hot reload in development**:
   - Changes to plugin frontend = instant reload
   - No rebuild of main app needed

## Appendix B: Technology Stack

```typescript
const TECH_STACK = {
  language: 'TypeScript',
  runtime: 'Node.js',
  
  backend: {
    framework: 'Custom (based on your current system)',
    database: ['PostgreSQL', 'MySQL', 'SQLite'],
    orm: 'Custom abstraction (Drizzle-like)',
    validation: 'Zod',
    testing: 'Vitest',
  },
  
  frontend: {
    framework: 'Next.js 14+',
    ui: 'React',
    styling: 'Tailwind CSS',
    components: 'Radix UI + shadcn/ui',
    state: 'Zustand',
    forms: 'React Hook Form',
  },
  
  admin: {
    framework: 'Next.js',
    ui: 'Custom components',
    editor: 'Lexical',
    charts: 'Recharts',
    tables: 'TanStack Table',
  },
  
  tools: {
    monorepo: 'Turborepo',
    bundler: 'tsup / Rollup',
    linter: 'ESLint',
    formatter: 'Prettier',
    docs: 'Mintlify / Docusaurus',
  },
  
  infrastructure: {
    hosting: ['Vercel', 'AWS', 'Self-hosted'],
    storage: ['S3', 'Cloudflare R2', 'Local'],
    cdn: 'Cloudflare',
    monitoring: 'Sentry',
    analytics: 'PostHog',
  },
}
```
