/**
 * @fromcode119/sdk — Public plugin API.
 *
 * Explicit curated exports for plugins and themes.
 * Only exports what external consumers (plugins/themes) should use.
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
 *   plugins/themes → @fromcode119/sdk → @fromcode119/core
 */

// ── Base Classes for Plugin Development ──────────────────────────────────────
export { BaseRepository, BaseService, BaseController } from '@fromcode119/core';
export { BaseRouter } from '@fromcode119/core';

// ── Utility Classes ───────────────────────────────────────────────────────────
export { CoercionUtils } from '@fromcode119/core';
export { StringUtils } from '@fromcode119/core';
export { NumberUtils } from '@fromcode119/core';
export { FormatUtils } from '@fromcode119/core';
export { RouteUtils } from '@fromcode119/core';
export { UrlUtils } from '@fromcode119/core';
export { ApiVersionUtils } from '@fromcode119/core';
export { LocalizationUtils } from '@fromcode119/core';
export type { NormalizeLocaleOptions, ResolveAnyStringOptions } from '@fromcode119/core';
export { CollectionUtils } from '@fromcode119/core';
export type { CollectionListPathOptions } from '@fromcode119/core';
export { HookEventUtils } from '@fromcode119/core';
export type { CollectionHookPhase, CollectionHookEvents } from '@fromcode119/core';
export { PaginationUtils } from '@fromcode119/core';
export type { PaginationInput, PaginationMeta } from '@fromcode119/core';
export { RelationUtils } from '@fromcode119/core';
export { ShortcodeUtils } from '@fromcode119/core';
export type {
  RenderShortcodesPayload,
  RenderShortcodesResponse,
  ShortcodeCatalogItem,
  ShortcodeCatalogResponse,
} from '@fromcode119/core';
export { PluginDefinitionUtils } from '@fromcode119/core';
export { RuntimeBridge } from '@fromcode119/core';
export type { FrontendRuntimeMetadata } from '@fromcode119/core';

// ── Constants ─────────────────────────────────────────────────────────────────
export { SystemConstants } from '@fromcode119/core';
export { RuntimeConstants } from '@fromcode119/core';
export { RouteConstants } from '@fromcode119/core';

// ── Logging ───────────────────────────────────────────────────────────────────
export { Logger } from '@fromcode119/core';
export { LogLevel } from '@fromcode119/core';
export type { LoggerOptions } from '@fromcode119/core';

// ── Configuration & Paths ─────────────────────────────────────────────────────
export { EnvConfig } from '@fromcode119/core';
export { ProjectPaths } from '@fromcode119/core';

// ── Registry & Context ────────────────────────────────────────────────────────
export { CapabilityRegistry } from '@fromcode119/core';
export type { CapabilityMetadata } from '@fromcode119/core';
export { IntegrationManager } from '@fromcode119/core';
export { IntegrationRegistry } from '@fromcode119/core';
export type { IntegrationTypeDefinition } from '@fromcode119/core';
export { RequestContextUtils } from '@fromcode119/core';
export type { RequestStore } from '@fromcode119/core';
export { RecordVersions } from '@fromcode119/core';

// ── Plugin Context & Schema Types ─────────────────────────────────────────────
// Enums and primitive types
export { PluginCapability, MiddlewareStage } from '@fromcode119/core';
export type { FieldType } from '@fromcode119/core';
export type { Access, CandidateLookupOptions, UpsertByCandidatesOptions } from '@fromcode119/core';

// Field/schema definitions
export type { Field, SettingsTab, PluginSettingsSchema } from '@fromcode119/core';
export type { Collection, CollectionQueryInterface } from '@fromcode119/core';

// Manifest definitions
export type { MiddlewareConfig, PluginManifest, ThemeManifest, MenuItemManifest } from '@fromcode119/core';

// Plugin runtime interfaces
export type { PluginContext, FromcodePlugin, LoadedPlugin } from '@fromcode119/core';
