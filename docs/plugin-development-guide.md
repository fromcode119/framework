# Plugin Development Guide

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
