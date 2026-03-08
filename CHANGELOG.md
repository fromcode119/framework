# Changelog

All notable changes to the Fromcode framework will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-03-08

### 🎉 Major Release: Class-Based Architecture

This release completes the migration to a fully class-based architecture, removing all deprecated function-based patterns. This is a **breaking change** for code still using legacy APIs.

### 💥 BREAKING CHANGES

#### Removed Router Setup Functions
All legacy router setup functions have been removed. Use Router classes instead:

**Removed**:
- `setupAuthRoutes()` → Use `AuthRouter` class
- `setupPluginRoutes()` → Use `PluginRouter` class  
- `setupThemeRoutes()` → Use `ThemeRouter` class
- `setupSystemRoutes()` → Use `SystemRouter` class
- `setupMediaRoutes()` → Use `MediaRouter` class
- `setupCollectionRoutes()` → Use `CollectionRouter` class
- `setupBaseCollectionRoutes()` → Use `BaseCollectionRouter` class

**Migration**:
```typescript
// ❌ OLD (removed in v2.0)
import { setupAuthRoutes } from '@fromcode119/api/routes';
app.use('/auth', setupAuthRoutes(manager, auth));

// ✅ NEW (v2.0+)
import { AuthRouter } from '@fromcode119/api/routes';
const authRouter = new AuthRouter(authController, authManager);
app.use('/auth', authRouter.router);
```

#### Removed Middleware Factories
Middleware factory functions have been removed. Use Middleware classes instead:

**Removed**:
- `createCollectionMiddleware()` → Use `CollectionMiddleware` class

**Migration**:
```typescript
// ❌ OLD (removed in v2.0)
import { createCollectionMiddleware } from '@fromcode119/api/middlewares';
const middleware = createCollectionMiddleware(manager);

// ✅ NEW (v2.0+)
import { CollectionMiddleware } from '@fromcode119/api/middlewares';
const middleware = new CollectionMiddleware(manager);
router.get('/:slug', middleware.middleware(), handler);
```

#### Removed Admin Utility Functions
Loose utility functions have been removed. Use `AdminServices` singleton instead:

**Removed**:
- `formatSize()` → `AdminServices.getInstance().formatter.formatSize()`
- `formatDate()` → `AdminServices.getInstance().formatter.formatDate()`
- `formatCurrency()` → `AdminServices.getInstance().formatter.formatCurrency()`
- `resolveMediaUrl()` → `AdminServices.getInstance().media.resolveMediaUrl()`
- `resolveLabelText()` → `AdminServices.getInstance().localization.resolveLabelText()`
- `capitalize()` → `AdminServices.getInstance().string.capitalize()`
- `normalizeString()` → `AdminServices.getInstance().string.normalize()`
- `getNestedValue()` → `AdminServices.getInstance().validation.getNestedValue()`
- `evaluateCondition()` → `AdminServices.getInstance().validation.evaluateCondition()`

**Migration**:
```typescript
// ❌ OLD (removed in v2.0)
import { formatSize, formatDate, resolveMediaUrl } from '@fromcode119/admin';

const size = formatSize(1024);
const date = formatDate(new Date());
const url = resolveMediaUrl('/path/to/image.jpg');

// ✅ NEW (v2.0+)
import { AdminServices } from '@fromcode119/admin';

const services = AdminServices.getInstance();
const size = services.formatter.formatSize(1024);
const date = services.formatter.formatDate(new Date());
const url = services.media.resolveMediaUrl('/path/to/image.jpg');
```

#### Deleted Files
The following legacy files have been removed from the codebase:

**API Package**:
- `packages/api/src/routes/auth.ts` (duplicate of AuthRouter)
- `packages/api/src/routes/themes.ts` (duplicate of ThemeRouter)
- `packages/api/src/routes/system.ts` (duplicate of SystemRouter)
- `packages/api/src/routes/media.ts` (duplicate of MediaRouter)
- `packages/api/src/routes/collections.ts` (duplicate of CollectionRouter)
- `packages/api/src/middlewares/collection.ts` (duplicate of CollectionMiddleware)

These were legacy duplicates maintained for backward compatibility. All functionality exists in the class-based equivalents.

### ✨ Added

#### AdminServices Singleton
- Centralized access to all admin utilities via `AdminServices.getInstance()`
- Namespaced services: `formatter`, `string`, `media`, `validation`, `localization`  
- Full TypeScript auto-complete support
- Consistent API across all utility functions

#### CoreServices Singleton
- Centralized access to all core services via `CoreServices.getInstance()`
- Services: `collection`, `localization`, `menu`, `content`
- Singleton pattern ensures consistent service instances

### 🔧 Changed

#### Architecture Improvements
- **Router Classes**: All routes now use class-based Router pattern with dependency injection
- **Middleware Classes**: All middleware now extends `BaseMiddleware` with typed `handle()` method
- **Service Singletons**: All utilities consolidated into service classes with singleton access

#### Code Quality
- **175 service tests** passing with 100% success rate (156ms execution)
- **Zero deprecated code** remaining in framework packages
- **150+ lines of deprecated code removed** across 16 files
- **6 duplicate legacy files deleted** (all functionality preserved in classes)

### 📚 Documentation

- Added comprehensive [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) with step-by-step examples
- Updated [DEPRECATION_AUDIT.md](./DEPRECATION_AUDIT.md) with Phase 8 completion details
- Added JSDoc deprecation notices to all removed functions (in v1.x releases)

### 🐛 Fixed

- Fixed orphaned return statement in `CollectionRouter.ts` after deprecated function removal
- Improved TypeScript types for all Router and Middleware classes
- Standardized error handling across all service classes

### ⚡ Performance

- Reduced `packages/admin/lib/utils.ts` from 154 lines → 27 lines (83% reduction)
- Eliminated duplicate code across 6 legacy files
- Improved bundle size through tree-shaking (unused legacy functions removed)

### 🔒 Security

- No security-related changes in this release
- All security standards maintained from v1.x

### 🧪 Testing

- ✅ 175/175 service tests passing (100% pass rate)
- ✅ LocalizationService: 31 tests  
- ✅ MenuService: 33 tests  
- ✅ ContentService: 48 tests  
- ✅ CoreServices: 23 tests  
- ✅ CollectionService: 40 tests
- Architecture check passes with no new violations

### 📦 Migration Statistics

**Phase 8 Summary** (Complete Deprecation Removal):
- **Files Modified**: 30+ files across framework
- **Files Deleted**: 6 legacy route/middleware files
- **Functions Removed**: 16 deprecated functions (6 router + 1 middleware + 9 admin utilities)
- **Lines Removed**: ~150 lines of deprecated code
- **Tests Passing**: 175/175 (100%)
- **Breaking Changes**: Well-documented with migration paths
- **Plugins Migrated**: 7 plugins (ecommerce, cms, finance, mlm, lms, logistics, forms)

### 🚀 Upgrade Guide

**For Plugin Developers**:
1. Read [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
2. Replace all router setup functions with Router classes
3. Replace all middleware factories with Middleware classes  
4. Replace all loose utilities with `AdminServices.getInstance()`
5. Run tests to verify migrations
6. Update plugin version to v2.0.0 compatibility

**For Theme Developers**:
- No breaking changes for themes in v2.0
- Themes using AdminServices are unaffected

**Estimated Migration Time**:
- Small plugin (1-5 files): 15-30 minutes
- Medium plugin (5-15 files): 1-2 hours  
- Large plugin (15+ files): 2-4 hours

### 📋 Checklist for v2.0 Migration

- [ ] Replace all `setupAuthRoutes()` → `AuthRouter` class
- [ ] Replace all `setupPluginRoutes()` → `PluginRouter` class
- [ ] Replace all `setupThemeRoutes()` → `ThemeRouter` class
- [ ] Replace all `setupSystemRoutes()` → `SystemRouter` class
- [ ] Replace all `setupMediaRoutes()` → `MediaRouter` class
- [ ] Replace all `setupCollectionRoutes()` → `CollectionRouter` class
- [ ] Replace all `createCollectionMiddleware()` → `CollectionMiddleware` class
- [ ] Replace all `formatSize()` → `AdminServices.getInstance().formatter.formatSize()`
- [ ] Replace all `formatDate()` → `AdminServices.getInstance().formatter.formatDate()`
- [ ] Replace all `resolveMediaUrl()` → `AdminServices.getInstance().media.resolveMediaUrl()`
- [ ] Run full test suite
- [ ] Check for TypeScript compilation errors
- [ ] Verify plugin functionality in development

### 🔗 Links

- [Migration Guide](./MIGRATION_GUIDE.md)
- [Deprecation Audit](./DEPRECATION_AUDIT.md)
- [AGENTS.md - Architecture Rules](./AGENTS.md)

---

## [1.0.31] - 2026-03-07

### ⚠️ Deprecation Notices (Pre-v2.0)

Added deprecation warnings for all legacy functions scheduled for removal in v2.0:

- Router setup functions deprecated (use Router classes)
- Middleware factory functions deprecated (use Middleware classes)
- Loose utility functions deprecated (use AdminServices/CoreServices)

### Added

- AdminServices singleton for centralized utility access
- CoreServices singleton for centralized service access
- Comprehensive JSDoc deprecation notices
- DEPRECATION_AUDIT.md tracking document

---

## [1.0.0] - 2026-01-15

Initial release of the Fromcode framework.

### Features

- Plugin architecture with hot-reloading
- Theme system with dynamic loading
- CMS, eCommerce, Finance, LMS, MLM, Logistics plugins
- Admin dashboard with React + Next.js
- PostgreSQL database with Drizzle ORM
- API server with Express
- Docker-based development environment

---

## Legend

- 💥 Breaking Change
- ✨ New Feature
- 🔧 Changed/Improved
- 🐛 Bug Fix
- ⚡ Performance
- 🔒 Security
- 📚 Documentation
- 🧪 Testing
- 📦 Dependencies
