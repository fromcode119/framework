# Plugin Development Guide

## Plugin Ecosystem

Atlantis ships with a growing ecosystem of domain plugins. Each plugin registers into the kernel
lifecycle and communicates only through the kernel context — never directly importing across plugin
boundaries.

### Available Plugins

Domain plugins register into the kernel lifecycle and are installed from the marketplace — the
public catalogue is being prepared for release. You can build your own today, or host a private
marketplace for your team.

Example domains a plugin can own:

| Domain | Purpose |
|--------|---------|
| Content | Headless CMS with block editor, pages, navigation, and collections |
| Commerce | Product registry, variant management, carts, and checkout flows |
| Ledger | Unified transaction engine, pricing, and revenue ledger |
| Delivery | Shipping providers, fulfillment tracking — country couriers as separate packs |
| Capture | Form builder, submission management, and webhook dispatch |
| Insights | Event tracking, dashboards, and traffic analytics |
| Discoverability | Meta management, sitemaps, structured data (redirect rules are framework-owned: Settings → Redirects) |

### Plugin Structure

```
plugins/<name>/
├── index.ts              # Exports only — thin entry point
├── manifest.json         # Plugin metadata, capabilities, dependencies
├── settings.ts           # Plugin configuration schema
├── src/
│   ├── on-init.ts        # Lifecycle registration (routes, hooks, collections)
│   ├── controllers/      # Request handlers — validation, orchestration
│   ├── services/         # Business logic — pure when possible
│   ├── repositories/     # Data access — queries only
│   └── types/            # TypeScript types, interfaces
├── collections/          # Drizzle database schemas
├── migrations/           # Schema migration files
└── ui/                   # Frontend bundle (React components)
```

### Plugin Communication — cross-plugin isolation rules

Plugins never import directly from other plugins. All cross-plugin communication goes through the kernel:

| Channel | When to Use | Example |
|---------|-------------|---------|
| **HTTP API** | Frontend/runtime calling a plugin's API | `Plugins.namespace('org.fromcode').finance.getOverview()` |
| **Hooks / Events** | Backend plugin notifying others | `context.hooks.on('order.created', handler)` |
| **Database** | Backend accessing shared collections | `context.db.query.orders.findMany(...)` |
| **Settings** | Reading global configuration | `context.settings.get()` |

> All plugin runtime access is **namespace-scoped**: `Plugins.namespace('org.fromcode').finance` — never `Plugins.finance` directly.

---

## Collection Slugs
When registering a collection, the framework automatically prefixes the table name with `fcp_{plugin_slug}_`. 

### Best Practice
Always use the primitive name for your collection slug. Do **not** include the plugin name in the slug.

**❌ Wrong:**
```typescript
context.collections.register({
  slug: 'cms-posts', // Resulting table: fcp_cms_cms-posts
  ...
});
```

**✅ Correct:**
```typescript
context.collections.register({
  slug: 'posts', // Resulting table: fcp_cms_posts
  ...
});
```

---

## Extending Collections
One plugin can extend a collection registered by another plugin. This is useful for injecting cross-cutting concerns like SEO fields, Analytics tracking, or Custom Metadata.

### API
`context.collections.extend(targetPlugin: string, targetCollection: string, extensions: Partial<Collection>)`

### Example: Injecting SEO fields from another plugin
In your `onInit`:

```typescript
context.collections.extend('cms', 'posts', {
  fields: [
    {
      name: 'seo_title',
      type: 'text',
      label: 'SEO Meta Title',
      admin: { position: 'sidebar' }
    }
  ]
});
```

The framework handles the order of execution. If the target collection is not yet registered, the extension is queued and automatically applied once the target plugin registers its collection.

---

## Hooks
The framework provides lifecycle hooks for collections.

- `collection:registered`: Emitted when any collection is registered.
- `collection:{slug}:beforeSave`: Emitted before a record is saved to the database.
- `collection:{slug}:afterSave`: Emitted after a record is saved.

### Example: Auto-generating SEO titles
```typescript
import { collectionHookEvents } from '@fromcode119/sdk';

const POSTS_HOOKS = collectionHookEvents('posts');

context.hooks.on(POSTS_HOOKS.beforeSave, async (post) => {
  if (!post.seo_title && post.title) {
    post.seo_title = post.title;
  }
  return post;
});
```
