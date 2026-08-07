// Types (includes all plugin/schema types moved from @fromcode119/sdk)
export * from '@core/enums';
export * from '@core/interfaces';
export * from '@core/default-page-contract';
export * from '@core/layout';
export * from '@core/plugin-context';
export * from '@core/screenshot';
export * from '@core/interfaces/collection-input.interface';
export * from '@core/interfaces/field-input.interface';
export type { IPluginInstallProgress } from '@core/plugin/interfaces/plugin-install-progress.interface';
export type { IPluginInstallProgressReporter } from '@core/plugin/interfaces/plugin-install-progress-reporter.interface';
export { RecordVersions } from '@core/collections/record-versions';

// Core Classes (Server-only)
export { ApiAccessGate } from '@core/plugin/context/api-access-gate';
export { AccessLevel } from '@core/plugin/context/enums/access-level.enum';
export { ApiPermissionRequirement } from '@core/plugin/context/api-permission-requirement';
export { LoadedPluginHydration } from '@core/plugin/services/loaded-plugin-hydration';
export { PluginRegistryHealth } from '@core/plugin/services/enums/plugin-registry-health.enum';
export { PluginHeldReason } from '@core/plugin/services/enums/plugin-held-reason.enum';
export { PluginHealthBucket } from '@core/plugin/services/enums/plugin-health-bucket.enum';
export { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
export { ThemeState } from '@core/theme/enums/theme-state.enum';
export { EnvUtils } from '@core/utils/env-utils';
export type { IApiAccessDescriptor } from '@core/plugin/context/interfaces/api-access-descriptor.interface';
export type { IApiPermissionCheck } from '@core/plugin/context/interfaces/api-permission-check.interface';
export { PluginManager } from '@core/plugin/plugin-manager';
export type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
export { ThemeManager } from '@core/theme/theme-manager';
export { ThemeDefaultPageContractOverrideLoader } from '@core/theme/theme-default-page-contract-override-loader';
export { AppearanceManager } from '@core/appearance/appearance-manager';
export { AppearanceInstallerService } from '@core/appearance/appearance-installer-service';
export type { IAppearanceSummary } from '@core/appearance/interfaces/appearance-summary.interface';
export type { IAppearanceManifest } from '@core/appearance/interfaces/appearance-manifest.interface';
export type { IAppearanceCatalogEntry } from '@core/appearance/interfaces/appearance-catalog-entry.interface';
export { CoreExtensionManager } from '@core/extensions/extension-manager';
export { ExtensionState } from '@core/extensions/enums/extension-state.enum';
export type { ICoreExtensionManifest } from '@core/extensions/interfaces/core-extension-manifest.interface';
export type { ILoadedCoreExtension } from '@core/extensions/interfaces/loaded-core-extension.interface';
export type { ICoreExtensionModule } from '@core/extensions/interfaces/core-extension-module.interface';
export type { ICoreExtensionContext } from '@core/extensions/interfaces/core-extension-context.interface';
export type { ICoreExtensionState } from '@core/extensions/interfaces/core-extension-state.interface';
export { SchemaManager } from '@core/database/schema-manager';
export { EntitySchemaPlanService } from '@core/database/entity-schema-plan-service';
export type { IEntitySchemaColumnPlan } from '@core/database/interfaces/entity-schema-column-plan.interface';
export type { IEntitySchemaPlan } from '@core/database/interfaces/entity-schema-plan.interface';
export { MigrationManager } from '@core/database/migration-manager';
export { Seeder } from '@core/database/seeder';
export { HookManager } from '@core/hooks/hook-manager';
export { HookAdapterFactory } from '@core/hooks/hook-adapter-factory';
export { QueueManager } from '@core/queue/queue-manager';
export { QueueAdapterFactory } from '@core/queue/queue-adapter-factory';
export { I18nManager } from '@core/i18n/i18n-manager';
export { WebSocketManager } from '@core/realtime/web-socket-manager';

// Capability Registry
export { CapabilityRegistry } from '@core/capabilities';
export type { ICapabilityMetadata } from '@core/interfaces/capability-metadata.interface';

// ── Logging ─────────────────────────────────────────────────────────────────
export { Logger } from '@core/logging';
export { LogLevel } from '@core/enums/log-level.enum';
export type { ILoggerOptions } from '@core/interfaces/logger-options.interface';

// ── Constants ────────────────────────────────────────────────────────────────
export { SystemConstants } from '@core/constants/system.constants';
export { ClientRuntimeConstants } from '@core/constants/client-runtime.constants';
export { CookieConstants } from '@core/constants/cookie.constants';
export { AppPathConstants } from '@core/constants/app-path.constants';
export { RequestSurfaceUtils } from '@core/request-surface-utils';
export { RuntimeLocationUtils } from '@core/runtime-location-utils';
export { RuntimeConstants } from '@core/constants/runtime.constants';
export { RuntimeRegistryAccess } from '@core/runtime-registry-access';
export { RouteConstants } from '@core/constants/route.constants';
export { AccountRouteUtils } from '@core/account-route-utils';
export { PublicRouteConstants } from '@core/constants/public-route.constants';

// ── Utility Classes ───────────────────────────────────────────────────────────
export { CoercionUtils } from '@core/coercion-utils';
export { StringUtils } from '@core/string-utils';
export { NumberUtils } from '@core/number-utils';
export { MeasurementSystemUtils } from '@core/measurement-system-utils';
export { FormatUtils } from '@core/format-utils';
export { ApiRequestError, ApiRequestService, ApiQueryUtils, ApiPathUtils } from '@core/api';
export { AdminUserClient, ApiScopeClient, CollectionScopeClient, SettingsScopeClient, SdkClient, AdminGlobalClient, AdminResourceClient, AdminSdkClient, BrowserStateClient, BrowserStateRuntimeBuilder, SystemAuthClient, SystemAuthSession } from '@core/clients';
export type { IBrowserCookieOptions } from '@core/clients';
export { RouteUtils } from '@core/route-utils';
export { UrlUtils } from '@core/url-utils';
export { ApplicationUrlUtils } from '@core/application-url-utils';
export { ApplicationHostUtils } from '@core/application-host-utils';
export { ApplicationDomainSettingsUtils } from '@core/application-domain-settings-utils';
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
export { BasePluginRouter } from '@core/base/base-plugin-router';
export type { IBasePluginRouterOptions } from '@core/base/interfaces/base-plugin-router-options.interface';
export { ManifestNormalizer } from '@core/manifest-normalizer';
export type { IPluginManifestInput } from '@core/interfaces/plugin-manifest-input.interface';
export type { IThemeManifestInput } from '@core/interfaces/theme-manifest-input.interface';
export { PluginHealthResponseBuilder } from '@core/plugin-health-response-builder';
export { PluginHealthRouteHandler } from '@core/plugin-health-route-handler';
export type { IPluginHealthProbeResult } from '@core/interfaces/plugin-health-probe-result.interface';
export type { IPluginHealthRouteHandlerOptions } from '@core/interfaces/plugin-health-route-handler-options.interface';
export type { IPluginHealthBuildOptions } from '@core/interfaces/plugin-health-build-options.interface';
export type { IPluginHealthIdentity } from '@core/interfaces/plugin-health-identity.interface';
export type { IPluginHealthResponse } from '@core/interfaces/plugin-health-response.interface';
export type { PluginHealthStatus } from '@core/enums/plugin-health-status.enum';
export { Plugins } from '@core/plugins';
export { PluginsFacade } from '@core/plugins-facade';
export { NamespacedPluginsFacade } from '@core/namespaced-plugins-facade';
export { PluginsRegistry } from '@core/plugins-registry';
export * from '@core/data-sources';

// ── Shared Utilities ──────────────────────────────────────────────────────────
export * from '@core/utils';
export { EnvConfig } from '@core/config/env';
export { SafeArchive } from '@core/security/safe-archive';
export { MediaPathUtils } from '@core/security/media-path-utils';
export { SystemSettingsExposureUtils } from '@core/security/system-settings-exposure-utils';
export { NetworkAddressUtils } from '@core/security/network-address-utils';
export { ProjectPaths } from '@core/config/paths';

// Integrations
export { IntegrationManager } from '@core/integrations/integration-manager';
export { IntegrationRegistry } from '@core/integrations/integration-registry';
export { SecretService } from '@core/security/secret-service';
export { SecretService as IntegrationSecretService } from '@core/security/secret-service';
export { SigningSecretService } from '@core/security/signing-secret-service';
export type { IIntegrationTypeDefinition } from '@core/integrations/interfaces/integration-type-definition.interface';
export type { IPluginApiResolver } from '@core/interfaces/plugin-api-resolver.interface';

// Context
export { RequestContextUtils } from '@core/context/request-context';
export type { IRequestStore } from '@core/context/interfaces/request-store.interface';

// Plugin Services (Server-only)
export { DiscoveryService } from '@core/plugin/services/discovery-service';
export { PluginDependencyInstallerService } from '@core/plugin/services/plugin-dependency-installer-service';
export { PluginStateService } from '@core/plugin/services/plugin-state-service';
export { MarketplaceCatalogService } from '@core/marketplace/marketplace-catalog-service';
export { RuntimeService } from '@core/plugin/services/runtime-service';
export { LifecycleService } from '@core/plugin/services/lifecycle-service';
export { MiddlewareManager } from '@core/plugin/services/middleware-manager';
export { AdminMetadataService } from '@core/plugin/services/admin-metadata-service';
export { PluginHealthReportService } from '@core/plugin/services/plugin-health-report-service';
export type { IPluginHealthEntryInput } from '@core/plugin/services/interfaces/plugin-health-entry-input.interface';
export type { IPluginHealthEntry } from '@core/plugin/services/interfaces/plugin-health-entry.interface';
export type { IPluginHealthReport } from '@core/plugin/services/interfaces/plugin-health-report.interface';

// Security (Server-only)
export { AuditManager } from '@core/security/audit-manager';
export { SecurityMonitor } from '@core/security/security-monitor';
export { PluginPermissionsService } from '@core/security/plugin-permissions-service';
export { PluginPermission } from '@core/security/enums/plugin-permission.enum';
export { PluginSignatureService } from '@core/security/plugin-signature-service';

// Management (Server-only)
export { PlatformSettingsService } from '@core/management/platform-settings-service';
export { BackupService } from '@core/management/backup-service';
export { BackupImportService } from '@core/management/backup-import-service';
export { ArchiveUploadSessionService } from '@core/management/archive-upload-session-service';
export type { ICreateSystemBackupOptions } from '@core/management/interfaces/create-system-backup-options.interface';
export { BackupSectionKey } from '@core/management/enums/backup-section-key.enum';
export { BackupCatalogService } from '@core/management/backup-catalog-service';
export type { IBackupCatalogGroup } from '@core/management/interfaces/backup-catalog-group.interface';
export type { IBackupCatalogItem } from '@core/management/interfaces/backup-catalog-item.interface';
export type { IBackupCatalogResolvedItem } from '@core/management/interfaces/backup-catalog-resolved-item.interface';
export { BackupCatalogRootKind } from '@core/management/enums/backup-catalog-root-kind.enum';
export { BackupCatalogGroupKey } from '@core/management/enums/backup-catalog-group-key.enum';
export { BackupRestoreGuardService } from '@core/management/backup-restore-guard-service';
export type { IRestoreExecutionInput } from '@core/management/interfaces/restore-execution-input.interface';
export type { IRestoreExecutionResult } from '@core/management/interfaces/restore-execution-result.interface';
export type { IRestorePreviewInput } from '@core/management/interfaces/restore-preview-input.interface';
export type { IRestoreTargetResolution } from '@core/management/interfaces/restore-target-resolution.interface';
export { SiteTransferBundleService } from '@core/management/site-transfer-bundle-service';
export type { ISiteTransferBundleManifest } from '@core/management/interfaces/site-transfer-bundle-manifest.interface';
export type { ISiteTransferBundleOptions } from '@core/management/interfaces/site-transfer-bundle-options.interface';
export type { ISiteTransferBundleResult } from '@core/management/interfaces/site-transfer-bundle-result.interface';
export { ManifestValidator, PluginManifestSchema, RegistryPluginSchema, RegistryManifestSchema } from '@core/management/manifest';
export { MigrationCoordinator } from '@core/management/migration-coordinator';
export { HotReloadService } from '@core/management/hot-reload-service';
export { SystemUpdateService } from '@core/management/system-update-service';

// Base Classes for Plugin Development
export { BaseRepository, BaseService, BaseController } from '@core/base';
export { AutocompleteOptionService } from '@core/services/autocomplete-option-service';
export { BaseRouter } from '@core/base/base-router';
export { AsyncRouteGuard } from '@core/base/async-route-guard';
export type { IRouteFailureOrigin } from '@core/base/interfaces/route-failure-origin.interface';
export { BaseEntity } from '@core/base/base-entity';
export { BaseEntityCollection } from '@core/base/base-entity-collection';
export { EntityColumn } from '@core/entity-column';
export { CollectionIdentityService } from '@core/services/collection-identity-service';
export { EntityValueParserService } from '@core/services/entity-value-parser-service';
export { EntityObjectMapperService } from '@core/services/entity-object-mapper-service';
export { EntityEnumResolverService } from '@core/services/entity-enum-resolver-service';
export { EntityMetadataService } from '@core/services/entity-metadata-service';
export { MediaRelationService } from '@core/services/media-relation-service';
export { EntityDefinitionUtils } from '@core/entity-definition-utils';
export { PluginLayoutRegistryService } from '@core/plugin/layout/plugin-layout-registry-service';
export { LayoutResolutionService } from '@core/plugin/layout/layout-resolution-service';
export { LayoutDiagnosticService } from '@core/plugin/layout/layout-diagnostic-service';
export { LayoutLifecycleService } from '@core/plugin/layout/layout-lifecycle-service';
export { LayoutRuntimeBridgeService } from '@core/plugin/layout/layout-runtime-bridge-service';
export { ThemeLayoutOverrideRegistryService } from '@core/theme/theme-layout-override-registry-service';
export type { IRegisteredWidgetDefinition, IWidgetDefinitionInput, IWidgetSettingsRenderInput, IWidgetStyle } from '@core/widget';
// VALUE export: `IWidgetStyle.visibility` is typed as this Enum, so plugins need its MEMBERS.
export { WidgetViewport } from '@core/widget';
export { ClientType } from '@core/enums/client-type.enum';
export { UiScope } from '@core/enums/ui-scope.enum';
export { ThemeMode } from '@core/enums/theme-mode.enum';
export { ExtensionKind } from '@core/plugin/enums/extension-kind.enum';
export { AuditOutcome } from '@core/security/enums/audit-outcome.enum';
export { SnapshotType } from '@core/management/enums/snapshot-type.enum';
export { EntityParseMode } from '@core/enums/entity-parse-mode.enum';
export { SortOrder } from '@core/enums/sort-order.enum';

// Enum classes plugins need to name (they were unreachable, forcing raw-string arguments).
// Owned by @fromcode119/scheduler (core depends on it, never the reverse). Re-exported so plugins
// keep importing it from the SDK — two copies meant `task.type === ScheduleType.CRON` was always false.
export { ScheduleType } from '@fromcode119/scheduler';
export { FilterKind } from '@core/data-sources/enums/filter-kind.enum';
export { DatasourceLayout } from '@core/data-sources/enums/datasource-layout.enum';
export { IntegrationConfigFieldType } from '@core/integrations/enums/integration-config-field-type.enum';
export { TwoFactorMethod } from '@core/enums/two-factor-method.enum';

// SERVER-only core services. `CoreServices` hands these out through `ServerServiceRegistry` instead of
// importing them, so the page-contract / seeding / collection-write modules never enter a browser
// bundle — see ServerServiceRegistry. `ServerCoreServices.register()` is called explicitly at API boot;
// it is deliberately NOT a barrel side effect, which tree-shaking makes unreliable.
export { ServerCoreServices } from '@core/services/server-core-services';
export { ServerServiceRegistry } from '@core/services/server-service-registry';
export { ServerServiceKey } from '@core/services/server-service-key';
