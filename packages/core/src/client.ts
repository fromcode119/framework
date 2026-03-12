/**
 * @fromcode119/core/client — Browser-safe subset of core.
 *
 * This entry point contains ONLY exports that are safe to include in client-side
 * (browser/Next.js client) bundles. All server-only classes are excluded.
 *
 * Excluded (server-only):
 *   - BaseRouter (imports express as a value / runtime dep)
 *   - IntegrationManager (imports @fromcode119/email, @fromcode119/media, @fromcode119/cache)
 *   - ProjectPaths (imports path, fs, process.cwd())
 *   - RequestContextUtils (imports async_hooks / AsyncLocalStorage)
 *   - PluginManager, ThemeManager, SchemaManager, MigrationManager, Seeder, etc.
 *   - DiscoveryService, LifecycleService, RuntimeService, etc.
 *   - All security/backup/management classes
 */

// ── Types (all safe — no runtime imports) ────────────────────────────────────
export * from './types';

// ── Collections ───────────────────────────────────────────────────────────────
export { RecordVersions } from './collections/record-versions';

// ── Capability Registry ───────────────────────────────────────────────────────
export { CapabilityRegistry } from './capabilities';
export type { CapabilityMetadata } from './capabilities.interfaces';

// ── Logging ───────────────────────────────────────────────────────────────────
export { Logger } from './logging';
export { LogLevel } from './logging.enums';
export type { LoggerOptions } from './logging.interfaces';

// ── Constants ─────────────────────────────────────────────────────────────────
export { SystemConstants } from './constants';
export { RuntimeConstants } from './runtime-constants';
export { RouteConstants } from './route-constants';

// ── Utility Classes ───────────────────────────────────────────────────────────
export { CoercionUtils } from './coercion-utils';
export { StringUtils } from './string-utils';
export { NumberUtils } from './number-utils';
export { FormatUtils } from './format-utils';
export { RouteUtils } from './route-utils';
export { UrlUtils } from './url-utils';
export { ApiVersionUtils } from './api-version';
export { LocalizationUtils } from './localization';
export type { NormalizeLocaleOptions, ResolveAnyStringOptions } from './localization.interfaces';
export { CollectionUtils } from './collection-utils';
export type { CollectionListPathOptions } from './collection-utils.interfaces';
export { HookEventUtils } from './hook-events';
export type { CollectionHookPhase, CollectionHookEvents } from './hook-events.types';
export { PaginationUtils } from './pagination';
export type { PaginationInput, PaginationMeta } from './pagination.interfaces';
export { RelationUtils } from './relations';
export { ShortcodeUtils } from './shortcodes';
export type {
  RenderShortcodesPayload,
  RenderShortcodesResponse,
  ShortcodeCatalogItem,
  ShortcodeCatalogResponse,
} from './shortcodes.types';
export { RuntimeBridge } from './runtime-bridge';
export type { FrontendRuntimeMetadata } from './runtime-bridge.interfaces';
export { PluginDefinitionUtils } from './plugin-definition-utils';

// ── Shared Utilities ──────────────────────────────────────────────────────────
export { CoreServices } from './services/core-services';
export { TypeUtils } from './utils/type-utils';

// ── Configuration ─────────────────────────────────────────────────────────────
export { EnvConfig } from './config/env';

// ── Base Classes (no server-only deps) ────────────────────────────────────────
// NOTE: BaseRouter is excluded — it imports express as a value (runtime dep).
// Import from specific files (not the barrel) to avoid BaseRouter being bundled.
// BaseController is safe — it only uses 'import type' for express types.
export { BaseRepository } from './base/base-repository';
export { BaseService } from './base/base-service';
export { BaseController } from './base/base-controller';

// ── Integrations (registry only — no provider implementations) ───────────────
export { IntegrationRegistry } from './integrations/integration-registry';
export type { IntegrationTypeDefinition } from './integrations/integration-registry.interfaces';
