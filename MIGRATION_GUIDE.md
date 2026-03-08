# Migration Guide: Class-Based Architecture

**Target Audience**: Plugin/theme developers migrating from legacy function-based patterns to new class-based architecture  
**Version**: v2.0 Migration Guide  
**Last Updated**: March 8, 2026  
**Status**: ✅ v2.0 Released - All deprecated code removed

---

## Table of Contents

1. [Overview](#overview)
2. [Breaking Changes](#breaking-changes)
3. [Migration Paths](#migration-paths)
   - [Router Migration](#router-migration)
   - [Middleware Migration](#middleware-migration)
   - [Configuration Migration](#configuration-migration)
   - [Admin Utilities Migration](#admin-utilities-migration)
   - [Core Utilities Migration](#core-utilities-migration)
4. [Real-World Examples](#real-world-examples)
5. [Testing After Migration](#testing-after-migration)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The Fromcode framework has migrated from mixed patterns (classes + loose functions) to a consistent class-based architecture. This guide helps you migrate your plugins and themes to the new API.

### Why Migrate?

- **Better Autocomplete**: Services are namespaced and easily discoverable
- **Easier Testing**: Classes are mockable, dependency injection ready
- **Type Safety**: Full TypeScript support with interfaces
- **Maintainability**: Logical grouping of related functionality
- **Future-Proof**: All new features will use class-based patterns

### Timeline

- **v1.0-1.31** (January-March 2026): Legacy functions work with deprecation warnings
- **v2.0-rc1** (March 7, 2026): Deprecation warnings in place, new classes available
- **v2.0** (March 8, 2026): **RELEASED** - Legacy functions removed, class-based architecture only

---

## Breaking Changes
Has Removed

1. **Route Setup Functions** → Router Classes ✅ REMOVED
2. **Middleware Factories** → Middleware Classes ✅ REMOVED
3. **Utility Functions** → Service Classes ✅ REMOVED

All deprecated code has been completely removed in v2.0. You **must** migrate to the new patterns to use v2.0+
All deprecated code will be completely removed in v2.0.

---

## Migration Paths

### Router Migration

#### Old Pattern (Deprecated)
```typescript
// plugins/my-plugin/src/routes.ts
import { setupAuthRoutes } from '@fromcode119/api/routes';

export function registerRoutes(app, dependencies) {
  app.use('/auth', setupAuthRoutes(dependencies.manager, dependencies.auth));
}
```

#### New Pattern (v2.0)
```typescript
// plugins/my-plugin/src/routers/AuthRouter.ts
import { BaseRouter } from '@fromcode119/api/routers';
import { AuthController } from '../controllers/AuthController';

export class AuthRouter extends BaseRouter {
  constructor(
    private controller: AuthController,
    private authMiddleware: AuthMiddleware
  ) {
    super();
  }

  protected registerRoutes(): void {
    this.post('/login', this.controller.login);
    this.post('/logout', 
      this.authMiddleware.middleware(), 
      this.controller.logout
    );
    this.get('/me', 
      this.asyncHandler(async (req, res) => {
        const user = await this.authMiddleware.getCurrentUser(req);
        res.json({ user });
      })
    );
  }
}

// plugins/my-plugin/src/on-init.ts
import { AuthRouter } from './routers/AuthRouter';

export async function onInit(context: PluginContext) {
  const controller = new AuthController(context);
  const authMiddleware = new AuthMiddleware(context.authManager);
  const authRouter = new AuthRouter(controller, authMiddleware);
  
  context.app.use('/auth', authRouter.router);
}
```

**Benefits**:
- Dependency injection (easy to test)
- Reusable across plugins
- Clear route organization

---

### Middleware Migration

#### Old Pattern (Deprecated)
```typescript
import { createAuthMiddleware } from '@fromcode119/api/middlewares';

const authMiddleware = createAuthMiddleware(authManager);
app.use(authMiddleware);
```

#### New Pattern (v2.0)
```typescript
import { AuthMiddleware } from '@fromcode119/api/middlewares';

const authMiddleware = new AuthMiddleware(authManager);
app.use(authMiddleware.middleware());
```

**Custom Middleware**:
```typescript
// Old
export function createCustomMiddleware(options) {
  return async (req, res, next) => {
    // logic
    next();
  };
}

// New
import { BaseMiddleware } from '@fromcode119/api/middlewares';

export class CustomMiddleware extends BaseMiddleware {
  constructor(private options: CustomOptions) {
    super();
  }

  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    // logic
    next();
  }
}

// Usage
const middleware = new CustomMiddleware({ /* options */ });
app.use(middleware.middleware());
```

---

### Configuration Migration

#### Old Pattern (Deprecated)
```typescript
import { 
  API_ROUTES, 
  STORAGE_CONFIG, 
  PUBLIC_ROUTE_PREFIXES 
} from '@fromcode119/api/constants';

const adminRoute = API_ROUTES.admin.base;
const uploadPath = STORAGE_CONFIG.upload.path;
```

#### New Pattern (v2.0)
```typescript
import { ApiConfig } from '@fromcode119/api';

const config = ApiConfig.getInstance();
const adminRoute = config.routes.admin.base;
const uploadPath = config.storage.upload.path;
```

**Benefits**:
- Single source of truth
- Type-safe getters
- Helper methods (e.g., `config.isReservedPermalink()`)

---

### Admin Utilities Migration

#### Old Pattern (Deprecated)
```typescript
import { 
  formatSize, 
  formatDate, 
  formatCurrency, 
  slugify 
} from '@fromcode119/admin/lib/utils';

const size = formatSize(1024); // "1.0 KB"
const slug = slugify('Hello World'); // "hello-world"
```

#### New Pattern (v2.0)
```typescript
import { AdminServices } from '@fromcode119/admin';

const services = AdminServices.getInstance();
const size = services.formatter.formatSize(1024); // "1.0 KB"
const slug = services.string.slugify('Hello World'); // "hello-world"
```

**Service Categories**:
```typescript
const services = AdminServices.getInstance();

// Formatting
services.formatter.formatSize(bytes);
services.formatter.formatDate(date);
services.formatter.formatCurrency(amount, 'USD');

// Strings
services.string.slugify(text);
services.string.capitalize(text);
services.string.excerpt(text, length);
services.string.truncate(text, length);

// Media
services.media.resolveMediaUrl(url);
services.media.getThumbnailUrl(url, width);
services.media.isImageUrl(url);

// Validation
services.validation.isValidEmail(email);
services.validation.isValidUrl(url);
services.validation.evaluateCondition(rule, data);

// Localization
services.localization.resolveLabelText(labelMap);
```

---

### Core Utilities Migration

#### Old Pattern (Deprecated)
```typescript
import { 
  normalizeLocaleCode, 
  extractTextFromContent, 
  generatePreviewUrl 
} from '@fromcode119/core/utils';

const locale = normalizeLocaleCode('en_US'); // "en-us"
const text = extractTextFromContent(blockData);
const url = generatePreviewUrl(baseUrl, record, collection);
```

#### New Pattern (v2.0)
```typescript
import { CoreServices } from '@fromcode119/core';

const services = CoreServices.getInstance();
const locale = services.localization.normalizeLocale('en_US'); // "en-us"
const text = services.content.extractText(blockData);
const url = services.collection.generatePreviewUrl(baseUrl, record, collection);
```

**Service Methods**:
```typescript
const services = CoreServices.getInstance();

// Localization
services.localization.normalizeLocale('en_US'); // "en-us"
services.localization.isLocaleKey('en'); // true
services.localization.isMeaningful('text'); // true
services.localization.resolveText({ en: 'Hello', bg: 'Здравей' }, 'en'); // "Hello"

// Content
services.content.extractText(blockEditorContent);
services.content.collectStrings({ nested: { data: 'value' } });
services.content.looksLikeJson('{"key":"value"}'); // true
services.content.parseAttributes('source="content" limit=5');
services.content.sanitizeKey('My-Key!'); // "my-key"

// Menu
services.menu.normalizeGroupKey('Admin', 'default');
services.menu.normalizePath('/Admin/'); // "/admin"
services.menu.getNestedPaths(menuItem);
services.menu.deduplicate(menuItems);

// Collection
services.collection.resolveBySlug(collections, 'cms', 'pages');
services.collection.generatePreviewUrl(baseUrl, record, collection, options);
services.collection.toDocs(apiResponse);
services.collection.findByCandidates(collection, ['slug1', 'slug2']);
services.collection.findAndUpsert(collection, candidates, data, options);
```

---

## Real-World Examples

### Example 1: E-commerce Plugin

#### Before
```typescript
// plugins/ecommerce/src/routes.ts
import { setupProductRoutes } from './routes/products';
import { formatCurrency } from '@fromcode119/admin/lib/utils';
import { generatePreviewUrl } from '@fromcode119/core/utils';

export function registerRoutes(app, context) {
  app.use('/products', setupProductRoutes(context));
  
  app.get('/product/:id/preview', async (req, res) => {
    const product = await context.db.findOne({ id: req.params.id });
    const price = formatCurrency(product.price, 'USD');
    const url = generatePreviewUrl(baseUrl, product, collection);
    res.json({ product, price, url });
  });
}
```

#### After
```typescript
// plugins/ecommerce/src/routers/ProductRouter.ts
import { BaseRouter } from '@fromcode119/api/routers';
import { AdminServices } from '@fromcode119/admin';
import { CoreServices } from '@fromcode119/core';

export class ProductRouter extends BaseRouter {
  private adminServices = AdminServices.getInstance();
  private coreServices = CoreServices.getInstance();

  constructor(
    private context: PluginContext
  ) {
    super();
  }

  protected registerRoutes(): void {
    this.get('/:id/preview', this.asyncHandler(this.getPreview.bind(this)));
  }

  private async getPreview(req: Request, res: Response): Promise<void> {
    const product = await this.context.db.findOne({ id: req.params.id });
    const price = this.adminServices.formatter.formatCurrency(product.price, 'USD');
    const url = this.coreServices.collection.generatePreviewUrl(
      req.headers.origin,
      product,
      this.context.collection,
      { prefix: 'products' }
    );
    res.json({ product, price, url });
  }
}
```

### Example 2: CMS Plugin with Localization

#### Before
```typescript
import { 
  resolveLocalizedText, 
  normalizeLocaleCode, 
  slugify 
} from '@fromcode119/core/utils';

const title = resolveLocalizedText(page.title, req.locale);
const locale = normalizeLocaleCode(req.locale);
const slug = slugify(title);
```

#### After
```typescript
import { CoreServices } from '@fromcode119/core';
import { AdminServices } from '@fromcode119/admin';

const core = CoreServices.getInstance();
const admin = AdminServices.getInstance();

const locale = core.localization.normalizeLocale(req.locale);
const title = core.localization.resolveText(page.title, locale);
const slug = admin.string.slugify(title);
```

---

## Testing After Migration

### Unit Test Example
```typescript
import { describe, it, expect, vi } from 'vitest';
import { CoreServices } from '@fromcode119/core';

describe('ProductRouter', () => {
  it('formats price correctly', async () => {
    const services = CoreServices.getInstance();
    const locale = services.localization.normalizeLocale('pt_BR');
    expect(locale).toBe('pt-br');
  });

  it('resets singleton for testing', () => {
    const instance1 = CoreServices.getInstance();
    CoreServices.reset();
    const instance2 = CoreServices.getInstance();
    expect(instance1).not.toBe(instance2);
  });
});
```

### Integration Test Example
```typescript
import { AdminServices } from '@fromcode119/admin';

describe('Order Processing', () => {
  it('formats currency in user locale', () => {
    const services = AdminServices.getInstance();
    
    const usd = services.formatter.formatCurrency(99.99, 'USD');
    const eur = services.formatter.formatCurrency(99.99, 'EUR');
    
    expect(usd).toContain('$');
    expect(eur).toContain('€');
  });
});
```

---

## Troubleshooting

### Issue: "Cannot read property of undefined"
**Cause**: Accessing service before getInstance()  
**Solution**:
```typescript
// ❌ Wrong
const locale = CoreServices.localization.normalizeLocale('en');

// ✅ Correct
const services = CoreServices.getInstance();
const locale = services.localization.normalizeLocale('en');
```

### Issue: "Module not found: @fromcode119/admin/lib/AdminServices"
**Cause**: Old import path  
**Solution**:
``typescript
// ❌ Wrong
import { AdminServices } from '@fromcode119/admin/lib/AdminServices';

// ✅ Correct
import { AdminServices } from '@fromcode119/admin';
```

### Issue: Tests fail after migration
**Cause**: Singleton state leaking between tests  
**Solution**:
```typescript
import { afterEach } from 'vitest';
import { CoreServices } from '@fromcode119/core';
import { AdminServices } from '@fromcode119/admin';

afterEach(() => {
  CoreServices.reset();
  AdminServices.reset();
});
```

### Issue: "formatSize is deprecated"
**Cause**: Using old utility function  
**Solution**: Check console warning for migration path
```
formatSize() is deprecated. Use AdminServices.getInstance().formatter.formatSize()
Will be removed in v2.0
```

---

## Quick Reference

### Import Cheat Sheet
```typescript
// Routers
import { BaseRouter } from '@fromcode119/api/routers';
import { AuthRouter, CollectionRouter } from '@fromcode119/api/routers';

// Middlewares
import { BaseMiddleware } from '@fromcode119/api/middlewares';
import { AuthMiddleware, CSRFMiddleware } from '@fromcode119/api/middlewares';

// Configuration
import { ApiConfig } from '@fromcode119/api';

// Services
import { AdminServices } from '@fromcode119/admin';
import { CoreServices } from '@fromcode119/core';
```

### Service Singleton Pattern
```typescript
// Always use getInstance()
const adminServices = AdminServices.getInstance();
const coreServices = CoreServices.getInstance();
const apiConfig = ApiConfig.getInstance();
```

### Class Extension Pattern
```typescript
// Extend base classes for custom functionality
import { BaseRouter } from '@fromcode119/api/routers';
import { BaseMiddleware } from '@fromcode119/api/middlewares';
import { BaseService } from '@fromcode119/admin/services';

export class MyRouter extends BaseRouter { }
export class MyMiddleware extends BaseMiddleware { }
export class MyService extends BaseService { }
```

---

## Next Steps

1. **Audit Your Code**: Search for deprecated imports
   ```bash
   grep -r "from '@fromcode119/api/routes'" plugins/
   grep -r "from '@fromcode119/admin/lib/utils'" plugins/
   ```

2. **Update Imports**: Replace old patterns with new classes

3. **Run Tests**: Ensure functionality unchanged
   ```bash
   npm test
   ```

4. **Remove Deprecation Warnings**: Check console for remaining warnings

5. **Update Documentation**: Document new patterns in your plugin README

---

**Need Help?** Check [AGENTS.md](./AGENTS.md) for class-based architecture patterns and examples.

**Questions?** Open an issue on GitHub: [fromcode119/framework](https://github.com/fromcode119/framework/issues)
