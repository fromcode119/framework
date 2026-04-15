/**
 * @fromcode119/sdk — Public plugin API.
 *
 * Explicit curated exports for plugins and themes.
 * Only exports what external consumers (plugins/themes) should use.
 *
 * This file imports exclusively from @fromcode119/core/client — a browser-safe
 * subset of core that excludes server-only code (express, fs, database packages, etc.).
 * This prevents server-only code from being bundled into client-side builds.
 *
 * Server-only exports (BaseRouter, BaseController, ProjectPaths, IntegrationManager,
 * RequestContextUtils) are in @fromcode119/sdk/server.
 *
 * Framework-internal classes intentionally excluded:
 *   PluginManager, ThemeManager, CoreExtensionManager,
 *   SchemaManager, MigrationManager, Seeder,
 *   HookManager, HookAdapterFactory,
 *   QueueManager, QueueAdapterFactory,
 *   I18nManager, WebSocketManager,
 *   DiscoveryService, PluginStateService, MarketplaceCatalogService,
 *   RuntimeService, LifecycleService, AdminMetadataService,
 *   AuditManager, SecurityMonitor, PluginPermissionsService, PluginSignatureService,
 *   BackupService, MigrationCoordinator, HotReloadService, SystemUpdateService,
 *   ManifestValidator, PluginManifestSchema, RegistryPluginSchema, RegistryManifestSchema,
 *   RegistryPlugin, RegistryManifest, PluginPermission, PluginManagerInterface
 *
 * Use @fromcode119/core directly in framework packages — not @fromcode119/sdk.
 *
 * Dependency direction:
 *   plugins/themes → @fromcode119/sdk → @fromcode119/core/client
 */

// ── Base Classes for Plugin Development ──────────────────────────────────────
// NOTE: BaseRouter is intentionally excluded — it imports express which pulls
// in Node.js built-ins (fs, stream, etc.) incompatible with client bundles.
// Use @fromcode119/sdk/server for server-only base classes.
// BaseController is safe — it only uses 'import type' for express types.
export { BaseRepository, BaseService, BaseController } from '@fromcode119/core/client';

// ── Utility Classes ───────────────────────────────────────────────────────────
export { CoercionUtils } from '@fromcode119/core/client';
export { StringUtils } from '@fromcode119/core/client';
export { NumberUtils } from '@fromcode119/core/client';
export { FormatUtils } from '@fromcode119/core/client';
export { ApiRequestError } from '@fromcode119/core/client';
export { ApiRequestService } from '@fromcode119/core/client';
export { ApiQueryUtils } from '@fromcode119/core/client';
export { ApiPathUtils } from '@fromcode119/core/client';
export { AdminUserClient } from '@fromcode119/core/client';
export { ApiScopeClient } from '@fromcode119/core/client';
export { CollectionScopeClient } from '@fromcode119/core/client';
export { SettingsScopeClient } from '@fromcode119/core/client';
export { SdkClient } from '@fromcode119/core/client';
export { AdminGlobalClient } from '@fromcode119/core/client';
export { AdminResourceClient } from '@fromcode119/core/client';
export { AdminSdkClient } from '@fromcode119/core/client';
export { BrowserStateClient } from '@fromcode119/core/client';
export { BrowserStateRuntimeBuilder } from '@fromcode119/core/client';
export { SystemAuthClient } from '@fromcode119/core/client';
export { SystemAuthSession } from '@fromcode119/core/client';
export type { BrowserCookieOptions } from '@fromcode119/core/client';
export { RouteUtils } from '@fromcode119/core/client';
export { UrlUtils } from '@fromcode119/core/client';
export { ApplicationUrlUtils } from '@fromcode119/core/client';
export { RuntimeLocationUtils } from '@fromcode119/core/client';
export { PublicAssetUrlUtils } from '@fromcode119/core/client';
export { ApiVersionUtils } from '@fromcode119/core/client';
export { LocalizationUtils } from '@fromcode119/core/client';
export type { NormalizeLocaleOptions, ResolveAnyStringOptions } from '@fromcode119/core/client';
export { CollectionUtils } from '@fromcode119/core/client';
export type { CollectionListPathOptions } from '@fromcode119/core/client';
export { HookEventUtils } from '@fromcode119/core/client';
export type { CollectionHookPhase, CollectionHookEvents } from '@fromcode119/core/client';
export { PaginationUtils } from '@fromcode119/core/client';
export type { PaginationInput, PaginationMeta } from '@fromcode119/core/client';
export { RelationUtils } from '@fromcode119/core/client';
export { ShortcodeUtils } from '@fromcode119/core/client';
export type {
  RenderShortcodesPayload,
  RenderShortcodesResponse,
  ShortcodeCatalogItem,
  ShortcodeCatalogResponse,
} from '@fromcode119/core/client';
export { PluginDefinitionUtils } from '@fromcode119/core/client';
export { Plugins } from '@fromcode119/core/client';
export { PluginsFacade } from '@fromcode119/core/client';
export { NamespacedPluginsFacade } from '@fromcode119/core/client';
export { PluginsRegistry } from '@fromcode119/core/client';
export { RuntimeBridge } from '@fromcode119/core/client';
export { CoreServices } from '@fromcode119/core/client';
export { MediaRelationService } from '@fromcode119/core/client';
export type { FrontendRuntimeMetadata } from '@fromcode119/core/client';

// ── Constants ─────────────────────────────────────────────────────────────────
export { SystemConstants } from '@fromcode119/core/client';
export { ClientRuntimeConstants } from '@fromcode119/core/client';
export { CookieConstants } from '@fromcode119/core/client';
export { RuntimeConstants } from '@fromcode119/core/client';
export { RouteConstants } from '@fromcode119/core/client';
export { PublicRouteConstants } from '@fromcode119/core/client';
export { DataSourceConstants } from '@fromcode119/core/client';

// ── Logging ───────────────────────────────────────────────────────────────────
export { Logger } from '@fromcode119/core/client';
export { LogLevel } from '@fromcode119/core/client';
export type { LoggerOptions } from '@fromcode119/core/client';

// ── Configuration ─────────────────────────────────────────────────────────────
// NOTE: ProjectPaths is server-only (uses path, fs, process.cwd()) — use
// @fromcode119/sdk/server to access it in plugin server code.
export { EnvConfig } from '@fromcode119/core/client';

// ── Registry & Context ────────────────────────────────────────────────────────
export { CapabilityRegistry } from '@fromcode119/core/client';
export type { CapabilityMetadata } from '@fromcode119/core/client';
// NOTE: IntegrationManager is server-only (@fromcode119/email, media, cache deps).
// Use @fromcode119/sdk/server to access IntegrationManager in plugin server code.
export { IntegrationRegistry } from '@fromcode119/core/client';
export type { IntegrationTypeDefinition } from '@fromcode119/core/client';
export type { PluginApiResolver } from '@fromcode119/core/client';
export type {
  PluginDefaultPageContractIdentity,
  PluginDefaultPageContract,
  PluginDefaultPageContractDependency,
  PluginDefaultPageContractKind,
  PluginDefaultPageContractMaterializationMode,
  PluginDefaultPageContractRegistration,
  RegisteredPluginDefaultPageContract,
  ThemeDefaultPageContractOverride,
} from '@fromcode119/core/client';
// RequestContextUtils / RequestStore intentionally omitted — server-only (AsyncLocalStorage),
// must not be bundled into client-side builds. Use @fromcode119/sdk/server.
export { RecordVersions } from '@fromcode119/core/client';

// ── Plugin Context & Schema Types ─────────────────────────────────────────────
// Enums and primitive types
export { PluginCapability, MiddlewareStage } from '@fromcode119/core/client';
export type { FieldType } from '@fromcode119/core/client';
export type { Access, CandidateLookupOptions, UpsertByCandidatesOptions } from '@fromcode119/core/client';

// Field/schema definitions
export type { Field, SettingsTab, PluginSettingsSchema } from '@fromcode119/core/client';
export type { Collection, CollectionQueryInterface } from '@fromcode119/core/client';

// Manifest definitions
export type { MiddlewareConfig, PluginManifest, ThemeManifest, MenuItemManifest } from '@fromcode119/core/client';
export type {
  DatasourceDescriptor,
  DatasourceOptionItem,
  DatasourceOptionsPayload,
  FilterDefinition,
} from '@fromcode119/core/client';

// Plugin runtime interfaces
export type { PluginContext, FromcodePlugin, LoadedPlugin } from '@fromcode119/core/client';
