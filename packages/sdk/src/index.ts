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
 *   z.infer<typeof RegistryPluginSchema.schema>, z.infer<typeof RegistryManifestSchema.schema>, PluginPermission, PluginManagerInterface
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
export { BaseEntity } from '@fromcode119/core/client';
export { BaseEntityCollection } from '@fromcode119/core/client';
export { EntityColumn } from '@fromcode119/core/client';
// Interactive-canvas + live-blocks: themes render these, so they belong on the theme-facing surface.
export { InteractiveCanvas } from '@fromcode119/core/client';
export { LiveBlocks } from '@fromcode119/core/client';

// ── Utility Classes ───────────────────────────────────────────────────────────
export { AccessLevel } from '@fromcode119/core/client';
export { CoercionUtils } from '@fromcode119/core/client';
export { StringUtils } from '@fromcode119/core/client';
export { NumberUtils } from '@fromcode119/core/client';
export { MeasurementSystemUtils } from '@fromcode119/core/client';
// The Enum itself, not just the utils: `MeasurementSystemUtils.normalize()` RETURNS it, so a plugin
// that stores or compares the result needs the type.
export { MeasurementSystem } from '@fromcode119/core/client';
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
export type { IBrowserCookieOptions } from '@fromcode119/core/client';
export { RouteUtils } from '@fromcode119/core/client';
export { UrlUtils } from '@fromcode119/core/client';
export { ApplicationUrlUtils } from '@fromcode119/core/client';
export { ApplicationHostUtils } from '@fromcode119/core/client';
export { RuntimeLocationUtils } from '@fromcode119/core/client';
export { PublicAssetUrlUtils } from '@fromcode119/core/client';
export { ApiVersionUtils } from '@fromcode119/core/client';
export { LocalizationUtils } from '@fromcode119/core/client';
export type { INormalizeLocaleOptions, IResolveAnyStringOptions } from '@fromcode119/core/client';
export { CollectionUtils } from '@fromcode119/core/client';
export { EntityDefinitionUtils } from '@fromcode119/core/client';
export { EntityValueParserService } from '@fromcode119/core/client';
export { EntityObjectMapperService } from '@fromcode119/core/client';
export { EntityEnumResolverService } from '@fromcode119/core/client';
export type { ICollectionListPathOptions } from '@fromcode119/core/client';
export { HookEventUtils } from '@fromcode119/core/client';
export type { ICollectionHookEvents } from '@fromcode119/core/client';
export { PaginationUtils } from '@fromcode119/core/client';
export type { IPaginationInput, IPaginationMeta } from '@fromcode119/core/client';
export { RelationUtils } from '@fromcode119/core/client';
export { ShortcodeUtils } from '@fromcode119/core/client';
export type { IRenderShortcodesPayload, IRenderShortcodesResponse, IShortcodeCatalogItem, IShortcodeCatalogResponse } from '@fromcode119/core/client';
export { PluginDefinitionUtils } from '@fromcode119/core/client';
export type { IPluginManifestInput, IThemeManifestInput } from '@fromcode119/core/client';
export { PluginHealthResponseBuilder } from '@fromcode119/core/client';
export type { IPluginHealthBuildOptions, IPluginHealthIdentity, IPluginHealthResponse } from '@fromcode119/core/client';
export { Plugins } from '@fromcode119/core/client';
export { PluginsFacade } from '@fromcode119/core/client';
export { NamespacedPluginsFacade } from '@fromcode119/core/client';
export { PluginsRegistry } from '@fromcode119/core/client';
export { RuntimeBridge } from '@fromcode119/core/client';
export { CoreServices } from '@fromcode119/core/client';
export { AutocompleteOptionService } from '@fromcode119/core/client';
export { MediaRelationService } from '@fromcode119/core/client';
export type { IFrontendRuntimeMetadata } from '@fromcode119/core/client';

// ── Constants ─────────────────────────────────────────────────────────────────
export { SystemConstants } from '@fromcode119/core/client';
export { ClientRuntimeConstants } from '@fromcode119/core/client';
export { CookieConstants } from '@fromcode119/core/client';
export { RuntimeConstants } from '@fromcode119/core/client';
export { RouteConstants } from '@fromcode119/core/client';
export { AccountRouteUtils } from '@fromcode119/core/client';
export { PublicRouteConstants } from '@fromcode119/core/client';
export { DataSourceConstants } from '@fromcode119/core/client';

// ── Logging ───────────────────────────────────────────────────────────────────
export { Logger } from '@fromcode119/core/client';
export { LogLevel } from '@fromcode119/core/client';
export type { ILoggerOptions } from '@fromcode119/core/client';

// ── Configuration ─────────────────────────────────────────────────────────────
// NOTE: ProjectPaths is server-only (uses path, fs, process.cwd()) — use
// @fromcode119/sdk/server to access it in plugin server code.
// EnvConfig is NOT exported here. It validates SERVER environment variables (DATABASE_URL, JWT_SECRET)
// with a zod schema — meaningless in a browser, and it pulled 59 KB of zod into every client bundle.
// It lives on the SERVER surface: `@fromcode119/sdk/server`.

// ── Registry & Context ────────────────────────────────────────────────────────
export { CapabilityRegistry } from '@fromcode119/core/client';
export type { ICapabilityMetadata } from '@fromcode119/core/client';
// NOTE: IntegrationManager is server-only (@fromcode119/email, media, cache deps).
// Use @fromcode119/sdk/server to access IntegrationManager in plugin server code.
// IntegrationRegistry is server-only — see the note in `@fromcode119/core`'s client surface.
export { PluginFrontendLayoutRegistrar, ThemeFrontendLayoutRegistrar } from '@fromcode119/core/client';
export type { IRegisteredWidgetDefinition, IWidgetDefinitionInput, IWidgetSettingsRenderInput, IWidgetStyle } from '@fromcode119/core/client';
export { WidgetViewport } from '@fromcode119/core/client';
export type { IIntegrationTypeDefinition } from '@fromcode119/core/client';
export type { IPluginApiResolver } from '@fromcode119/core/client';
export type { IPluginDefaultPageContractIdentity, IPluginDefaultPageContract, IPluginDefaultPageContractRegistration, IRegisteredPluginDefaultPageContract, IThemeDefaultPageContractOverride, ILayoutDiagnosticEntry, ILayoutOwnerIdentity, IPluginLayoutDefinition, IPluginLayoutRegistration, IRegisteredPluginLayoutDefinition, IRegisteredThemeLayoutDisableDefinition, IRegisteredThemeLayoutReplacementDefinition, IResolvedLayout, IThemeLayoutDisableDefinition, IThemeLayoutOverrideRegistration, IThemeLayoutReplacementDefinition, IPluginFrontendLayoutRegistrarOptions, IThemeFrontendLayoutRegistrarOptions } from '@fromcode119/core/client';
// RequestContextUtils / RequestStore intentionally omitted — server-only (AsyncLocalStorage),
// must not be bundled into client-side builds. Use @fromcode119/sdk/server.
export { RecordVersions } from '@fromcode119/core/client';

// ── Plugin Context & Schema Types ─────────────────────────────────────────────
// Enums and primitive types
export { PluginCapability, MiddlewareStage } from '@fromcode119/core/client';

export type { IAccess, ICandidateLookupOptions, IUpsertByCandidatesOptions } from '@fromcode119/core/client';

// Field/schema definitions
export type { IField, ISettingsTab, IPluginSettingsSchema } from '@fromcode119/core/client';
export type { ICollection, ICollectionQueryInterface, IEntityAdminLayout, IEntityApiOptions, IEntityDefinition, IEntityDerivedField, IEntityField, IEntityFieldValidationError, IEntityIndex, IEntityInputAlias, IEntityParseOptions, IEntityParseResult, IEntityEnumOptions, IEntityFieldConfig, IEntityFieldsConfig } from '@fromcode119/core/client';

// Manifest definitions
export type { IMiddlewareConfig, IPluginManifest, IThemeManifest, IMenuItemManifest } from '@fromcode119/core/client';
export type { IDatasourceDescriptor, IDatasourceOptionItem, IDatasourceOptionsPayload, IFilterDefinition } from '@fromcode119/core/client';

// Plugin runtime interfaces
export type { PluginContext, IFromcodePlugin, ILoadedPlugin } from '@fromcode119/core/client';

// ── Theme Registration & Style Variant Types ─────────────────────────────────
export type { IThemeStyleVariant } from '@sdk/types/interfaces/theme-style-variant.interface';
export type { IThemeRegistration } from '@sdk/types/interfaces/theme-registration.interface';

// Server-safe reactor primitives. `Enum` has no React dependency, so backend plugin code can
// use it — unlike `@fromcode119/sdk/react`, which cannot load under Node (it requires CSS).
export { Enum } from '@fromcode119/reactor';

// These are Enum CLASSES, not type aliases — a `export type` re-export makes the members
// (`FieldType.TEXT`, `PluginDefaultPageContractKind.DETAIL`) unreachable from plugin code,
// which is why plugins were forced to pass raw strings that then fail to type-check.
export { CollectionHookPhase, EntityFieldTransform, FieldType, LayoutDiagnosticCode, LayoutDiagnosticSeverity, LayoutResolutionSource, LayoutResolutionStatus, LayoutTargetKind, PluginDefaultPageContractDependency, PluginDefaultPageContractKind, PluginDefaultPageContractMaterializationMode, PluginHealthStatus } from '@fromcode119/core/client';

// More Enum classes surfaced to plugins as VALUES, not just types.
export { DatasourceLayout, ExtensionKind, FilterKind, IntegrationConfigFieldType, ScheduleType } from '@fromcode119/core/client';
export { SortDirection } from '@fromcode119/database';
export { CodeLanguage } from '@fromcode119/core/client';
// Light/dark. Storefront components need it as much as admin ones, and `@fromcode119/sdk/admin` is an
// ADMIN-only surface — importing it from a `.storefront` bundle broke the frontend at runtime
// ("does not provide an export named 'ThemeMode'"), taking the whole page body with it.
export { ThemeMode } from '@fromcode119/core/client';
// The per-locale field editor. It was already on the BROWSER sdk surface (the runtime bridge's
// `SdkExportSourceBuilder` list) but never on this one, so `import { LocalizedField } from
// '@fromcode119/sdk'` worked in a browser bundle and threw `Named export 'LocalizedField' not found`
// the moment the same plugin code was imported by Node — which is what server-rendering a plugin's
// storefront UI does. The two surfaces must not diverge.
export { LocalizedField } from '@fromcode119/core/client';
// Same divergence, found by diffing the two surfaces: on the browser list, absent here. Closed now
// rather than when it next breaks a Node import of plugin code.
export { PublicSettings } from '@fromcode119/core/client';
