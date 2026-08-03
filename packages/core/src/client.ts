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
export * from '@core/enums';
export * from '@core/interfaces';
export * from '@core/default-page-contract';
export * from '@core/layout';
export * from '@core/plugin-context';
export * from '@core/screenshot';
export * from '@core/interfaces/collection-input.interface';
export * from '@core/interfaces/field-input.interface';

// ── Collections ───────────────────────────────────────────────────────────────
export { RecordVersions } from '@core/collections/record-versions';

// ── Capability Registry ───────────────────────────────────────────────────────
export { CapabilityRegistry } from '@core/capabilities';
export type { ICapabilityMetadata } from '@core/interfaces/capability-metadata.interface';

// ── Logging ───────────────────────────────────────────────────────────────────
export { Logger } from '@core/logging';
export { LogLevel } from '@core/enums/log-level.enum';
export { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
export { ApiPermissionRequirement } from '@core/plugin/context/api-permission-requirement';
export type { ILoggerOptions } from '@core/interfaces/logger-options.interface';

// ── Constants ─────────────────────────────────────────────────────────────────
export { SystemConstants } from '@core/constants/system.constants';
export { ClientRuntimeConstants } from '@core/constants/client-runtime.constants';
export { CookieConstants } from '@core/constants/cookie.constants';
export { AppPathConstants } from '@core/constants/app-path.constants';
export { RuntimeConstants } from '@core/constants/runtime.constants';
export { RuntimeRegistryAccess } from '@core/runtime-registry-access';
export { RouteConstants } from '@core/constants/route.constants';
export { AccountRouteUtils } from '@core/account-route-utils';
export { PublicRouteConstants } from '@core/constants/public-route.constants';

// ── Utility Classes ───────────────────────────────────────────────────────────
export { EnvUtils } from '@core/utils/env-utils';
export { CoercionUtils } from '@core/coercion-utils';
export { StringUtils } from '@core/string-utils';
export { NumberUtils } from '@core/number-utils';
export { MeasurementSystemUtils } from '@core/measurement-system-utils';
export { FormatUtils } from '@core/format-utils';
export { ApiRequestError, ApiRequestService, ApiQueryUtils, ApiPathUtils } from '@core/api';
export { AdminUserClient, ApiScopeClient, CollectionScopeClient, SettingsScopeClient, SdkClient, AdminGlobalClient, AdminResourceClient, AdminSdkClient, BrowserStateClient, BrowserStateRuntimeBuilder, SystemAuthClient, SystemAuthSession } from '@core/clients';
export type { IBrowserCookieOptions } from '@core/clients';
export { PluginFrontendRuntimeUtils } from '@core/plugin-frontend-runtime-utils';
export { RouteUtils } from '@core/route-utils';
export { UrlUtils } from '@core/url-utils';
export { ApplicationUrlUtils } from '@core/application-url-utils';
export { ApplicationHostUtils } from '@core/application-host-utils';
export { RuntimeLocationUtils } from '@core/runtime-location-utils';
export { PublicAssetUrlUtils } from '@core/public-asset-url-utils';
export { ApiVersionUtils } from '@core/api-version';
export { LocalizationUtils } from '@core/localization';
export type { INormalizeLocaleOptions } from '@core/interfaces/normalize-locale-options.interface';
export type { IResolveAnyStringOptions } from '@core/interfaces/resolve-any-string-options.interface';
export { CollectionUtils } from '@core/collection-utils';
export type { ICollectionListPathOptions } from '@core/interfaces/collection-list-path-options.interface';
export { HookEventUtils } from '@core/hook-events';
// CollectionHookPhase is an Enum CLASS — a VALUE export, or plugins cannot reach `.BEFORE_CREATE` and
// are forced back to raw strings. Only the events interface is type-only.
export { CollectionHookPhase } from '@core/interfaces/collection-hook-events.interface';
export type { ICollectionHookEvents } from '@core/interfaces/collection-hook-events.interface';
export { PaginationUtils } from '@core/pagination';
export type { IPaginationInput } from '@core/interfaces/pagination-input.interface';
export type { IPaginationMeta } from '@core/interfaces/pagination-meta.interface';
export { RelationUtils } from '@core/relations';
export { ShortcodeUtils } from '@core/shortcodes';
export type { IRenderShortcodesPayload } from '@core/interfaces/render-shortcodes-payload.interface';
export type { IRenderShortcodesResponse } from '@core/interfaces/render-shortcodes-response.interface';
export type { IShortcodeCatalogItem } from '@core/interfaces/shortcode-catalog-item.interface';
export type { IShortcodeCatalogResponse } from '@core/interfaces/shortcode-catalog-response.interface';
export { RuntimeBridge } from '@core/runtime-bridge';
export type { IFrontendRuntimeMetadata } from '@core/interfaces/frontend-runtime-metadata.interface';
export { PluginDefinitionUtils } from '@core/plugin-definition-utils';
export type { IPluginManifestInput } from '@core/interfaces/plugin-manifest-input.interface';
export type { IThemeManifestInput } from '@core/interfaces/theme-manifest-input.interface';
export { PluginHealthResponseBuilder } from '@core/plugin-health-response-builder';
export type { IPluginHealthBuildOptions } from '@core/interfaces/plugin-health-build-options.interface';
export type { IPluginHealthIdentity } from '@core/interfaces/plugin-health-identity.interface';
export type { IPluginHealthResponse } from '@core/interfaces/plugin-health-response.interface';
export { LoadedPluginHydration } from '@core/plugin/services/loaded-plugin-hydration';
export { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
export { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
export { PluginHealthBucket } from '@core/plugin/services/enums/plugin-health-bucket.enum';
export { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
export { ThemeState } from '@core/theme/enums/theme-state.enum';
export { Plugins } from '@core/plugins';
export { PluginsFacade } from '@core/plugins-facade';
export { NamespacedPluginsFacade } from '@core/namespaced-plugins-facade';
export { PluginsRegistry } from '@core/plugins-registry';
export * from '@core/data-sources';

// ── Shared Utilities ──────────────────────────────────────────────────────────
export { CoreServices } from '@core/services/core-services';
export { AutocompleteOptionService } from '@core/services/autocomplete-option-service';
export { CollectionIdentityService } from '@core/services/collection-identity-service';
export { EntityValueParserService } from '@core/services/entity-value-parser-service';
export { EntityObjectMapperService } from '@core/services/entity-object-mapper-service';
export { EntityEnumResolverService } from '@core/services/entity-enum-resolver-service';
export { MediaRelationService } from '@core/services/media-relation-service';
export { EntityDefinitionUtils } from '@core/entity-definition-utils';
export { PluginLayoutRegistryService } from '@core/plugin/layout/plugin-layout-registry-service';
export { LayoutResolutionService } from '@core/plugin/layout/layout-resolution-service';
export { LayoutDiagnosticService } from '@core/plugin/layout/layout-diagnostic-service';
export { LayoutLifecycleService } from '@core/plugin/layout/layout-lifecycle-service';
export { LayoutRuntimeBridgeService } from '@core/plugin/layout/layout-runtime-bridge-service';
export { PluginFrontendLayoutRegistrar, ThemeFrontendLayoutRegistrar } from '@core/layout';
export type { IRegisteredWidgetDefinition, IWidgetDefinitionInput, IWidgetSettingsRenderInput, IWidgetStyle } from '@core/widget';
export type { IPluginFrontendLayoutRegistrarOptions, IPluginFrontendLayoutRegistration, IThemeFrontendLayoutRegistrarOptions, IThemeFrontendLayoutRegistration } from '@core/layout';
export { ThemeLayoutOverrideRegistryService } from '@core/theme/theme-layout-override-registry-service';
export { TypeUtils } from '@core/utils/type-utils';

// ── Configuration ─────────────────────────────────────────────────────────────
// EnvConfig is NOT re-exported here. It validates SERVER environment variables (DATABASE_URL,
// JWT_SECRET, …) with a zod schema, which is meaningless in a browser and dragged **59 KB of zod** into
// every client bundle — measured as the single largest module in the storefront's provider graph. It
// stays available from `@fromcode119/core` (the server surface), where it belongs.

// ── Base Classes (no server-only deps) ────────────────────────────────────────
// NOTE: BaseRouter is excluded — it imports express as a value (runtime dep).
// Import from specific files (not the barrel) to avoid BaseRouter being bundled.
// BaseController is safe — it only uses 'import type' for express types.
export { BaseRepository } from '@core/base/base-repository';
export { BaseService } from '@core/base/base-service';
export { BaseController } from '@core/base/base-controller';
export { BaseEntity } from '@core/base/base-entity';
export { BaseEntityCollection } from '@core/base/base-entity-collection';
export { EntityColumn } from '@core/entity-column';

// ── Integrations (registry only — no provider implementations) ───────────────
// IntegrationRegistry is NOT re-exported here. Integrations are configured in ADMIN and their
// credentials are resolved SERVER-side; nothing in any browser bundle — framework, plugin UI or theme —
// referenced it, while it pulled the whole integration service tree (~17 KB) into every client bundle.
// It stays on `@fromcode119/core` for server code.
export type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';
export type { IPluginApiResolver } from '@core/interfaces/plugin-api-resolver.interface';

// ── Interactive Canvas (visual editor primitives) ─────────────────────────────
export { InteractiveCanvas } from '@core/interactive-canvas/view/interactive-canvas-context.client';
export { LiveBlocks } from '@core/live-blocks';
export { LocalizedField } from '@core/view/localized-field.client';
export { PublicSettings } from '@core/public-settings';

// ── Backup enums (browser-safe: pure reactor `Enum` value objects, no fs/express) ─────────────
// The backup SERVICES stay server-only, but the admin UI needs these section/group/kind values at
// runtime (they were plain string-union TYPES before, so they used to erase at the boundary).
export { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
export { BackupCatalogRootKind } from '@core/management/enums/backup-catalog-root-kind.enum';
export { BackupCatalogGroupKey } from '@core/management/enums/backup-catalog-group-key.enum';

// ── Shared UI/runtime enums (browser-safe reactor `Enum` value objects) ───────
export { ClientType } from '@core/enums/client-type.enum';
export { UiScope } from '@core/enums/ui-scope.enum';
export { ThemeMode } from '@core/enums/theme-mode.enum';
export { LayoutTargetKind } from '@core/layout/enums/layout-target-kind.enum';
export { LayoutResolutionSource } from '@core/layout/enums/layout-resolution-source.enum';
export { LayoutResolutionStatus } from '@core/layout/enums/layout-resolution-status.enum';
export { LayoutDiagnosticSeverity } from '@core/layout/enums/layout-diagnostic-severity.enum';
export { LayoutDiagnosticCode } from '@core/layout/enums/layout-diagnostic-code.enum';
export { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';
export { MeasurementSystem } from '@core/enums/measurement-system.enum';
export { FieldPosition } from '@core/enums/field-position.enum';
export { EntityParseMode } from '@core/enums/entity-parse-mode.enum';
export { ThemeSettingType } from '@core/enums/theme-setting-type.enum';
export { ThemeConfigFieldType } from '@core/enums/theme-config-field-type.enum';
export { CodeLanguage } from '@core/enums/code-language.enum';
export { ConditionOperator } from '@core/enums/condition-operator.enum';
export { FieldWidth } from '@core/enums/field-width.enum';
export { CollectionKind } from '@core/enums/collection-kind.enum';

// Enum classes plugins need to name (they were unreachable, forcing raw-string arguments).
export { ExtensionKind } from '@core/plugin/enums/extension-kind.enum';
// Owned by @fromcode119/scheduler (core depends on it, never the reverse). Re-exported so plugins
// keep importing it from the SDK — two copies meant `task.type === ScheduleType.CRON` was always false.
export { ScheduleType } from '@fromcode119/scheduler';
export { FilterKind } from '@core/data-sources/enums/filter-kind.enum';
export { DatasourceLayout } from '@core/data-sources/enums/datasource-layout.enum';
export { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
// Duplicated in the frontend/admin before this — one class, or a cross-package `===` is always false.
export { InjectionTarget } from '@core/enums/injection-target.enum';
export { SnapshotType } from '@core/management/enums/snapshot-type.enum';
// One owner: the frontend reads it from the `locale_url_strategy` setting and the admin WRITES that
// setting — two classes meant the admin's PATH could never equal the frontend's PATH.
export { LocaleUrlStrategy } from '@core/enums/locale-url-strategy.enum';
export { TwoFactorMethod } from '@core/enums/two-factor-method.enum';
