// Types (includes all plugin/schema types moved from @fromcode119/sdk)
export * from './types';
export { RecordVersions } from './collections/record-versions';

// Core Classes (Server-only)
export { PluginManager } from './plugin/plugin-manager';
export type { PluginManagerInterface } from './plugin/context/utils.interfaces';
export { ThemeManager } from './theme/theme-manager';
export { ThemeDefaultPageContractOverrideLoader } from './theme/theme-default-page-contract-override-loader';
export { CoreExtensionManager } from './extensions/extension-manager';
export type {
  CoreExtensionManifest,
  LoadedCoreExtension,
  CoreExtensionModule,
  CoreExtensionContext,
  CoreExtensionState,
} from './extensions/types';
export { SchemaManager } from './database/schema-manager';
export { MigrationManager } from './database/migration-manager';
export { Seeder } from './database/seeder';
export { HookManager } from './hooks/hook-manager';
export { HookAdapterFactory } from './hooks/hook-adapter-factory';
export { QueueManager } from './queue/queue-manager';
export { QueueAdapterFactory } from './queue/queue-adapter-factory';
export { I18nManager } from './i18n/i18n-manager';
export { WebSocketManager } from './realtime/web-socket-manager';

// Capability Registry
export { CapabilityRegistry } from './capabilities';
export type { CapabilityMetadata } from './capabilities.interfaces';

// ── Logging ─────────────────────────────────────────────────────────────────
export { Logger } from './logging';
export { LogLevel } from './logging.enums';
export type { LoggerOptions } from './logging.interfaces';

// ── Constants ────────────────────────────────────────────────────────────────
export { SystemConstants } from './constants';
export { ClientRuntimeConstants } from './client-runtime-constants';
export { CookieConstants } from './cookie-constants';
export { AppPathConstants } from './app-path-constants';
export { RequestSurfaceUtils } from './request-surface-utils';
export { RuntimeLocationUtils } from './runtime-location-utils';
export { RuntimeConstants } from './runtime-constants';
export { RouteConstants } from './route-constants';
export { PublicRouteConstants } from './public-route-constants';

// ── Utility Classes ───────────────────────────────────────────────────────────
export { CoercionUtils } from './coercion-utils';
export { StringUtils } from './string-utils';
export { NumberUtils } from './number-utils';
export { FormatUtils } from './format-utils';
export { ApiRequestError, ApiRequestService, ApiQueryUtils, ApiPathUtils } from './api';
export {
  AdminUserClient,
  ApiScopeClient,
  CollectionScopeClient,
  SettingsScopeClient,
  SdkClient,
  AdminGlobalClient,
  AdminResourceClient,
  AdminSdkClient,
  BrowserStateClient,
  BrowserStateRuntimeBuilder,
  SystemAuthClient,
  SystemAuthSession,
} from './clients';
export type { BrowserCookieOptions } from './clients';
export { RouteUtils } from './route-utils';
export { UrlUtils } from './url-utils';
export { ApplicationUrlUtils } from './application-url-utils';
export { PublicAssetUrlUtils } from './public-asset-url-utils';
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
export type { RenderShortcodesPayload, RenderShortcodesResponse, ShortcodeCatalogItem, ShortcodeCatalogResponse } from './shortcodes.types';
export { RuntimeBridge } from './runtime-bridge';
export type { FrontendRuntimeMetadata } from './runtime-bridge.interfaces';
export { PluginDefinitionUtils } from './plugin-definition-utils';
export { Plugins } from './plugins';
export { PluginsFacade } from './plugins-facade';
export { NamespacedPluginsFacade } from './namespaced-plugins-facade';
export { PluginsRegistry } from './plugins-registry';
export * from './data-sources';

// ── Shared Utilities ──────────────────────────────────────────────────────────
export * from './utils';
export { EnvConfig } from './config/env';
export { ProjectPaths } from './config/paths';

// Integrations
export { IntegrationManager } from './integrations/integration-manager';
export { IntegrationRegistry } from './integrations/integration-registry';
export type { IntegrationTypeDefinition } from './integrations/integration-registry.interfaces';
export type { PluginApiResolver } from './plugin-api-resolver.interfaces';

// Context
export { RequestContextUtils } from './context/request-context';
export type { RequestStore } from './context/request-context.interfaces';

// Plugin Services (Server-only)
export { DiscoveryService } from './plugin/services/discovery-service';
export { PluginDependencyInstallerService } from './plugin/services/plugin-dependency-installer-service';
export { PluginStateService } from './plugin/services/plugin-state-service';
export { MarketplaceCatalogService } from './marketplace/marketplace-catalog-service';
export { RuntimeService } from './plugin/services/runtime-service';
export { LifecycleService } from './plugin/services/lifecycle-service';
export { AdminMetadataService } from './plugin/services/admin-metadata-service';

// Security (Server-only)
export { AuditManager } from './security/audit-manager';
export { SecurityMonitor } from './security/security-monitor';
export { PluginPermissionsService } from './security/plugin-permissions-service';
export type { PluginPermission } from './security/plugin-permissions-service.types';
export { PluginSignatureService } from './security/plugin-signature-service';

// Management (Server-only)
export { BackupService } from './management/backup-service';
export { BackupImportService } from './management/backup-import-service';
export type { CreateSystemBackupOptions } from './management/backup-service.interfaces';
export type { BackupSectionKey } from './management/backup-service.types';
export { BackupCatalogService } from './management/backup-catalog-service';
export type {
  BackupCatalogGroup,
  BackupCatalogItem,
  BackupCatalogResolvedItem,
} from './management/backup-catalog-service.types';
export { BackupRestoreGuardService } from './management/backup-restore-guard-service';
export type {
  RestoreExecutionInput,
  RestoreExecutionResult,
  RestorePreviewInput,
  RestoreTargetResolution,
} from './management/backup-restore-guard-service.interfaces';
export type { RestoreTargetKind } from './management/backup-restore-guard-service.types';
export { SiteTransferBundleService } from './management/site-transfer-bundle-service';
export type {
  SiteTransferBundleManifest,
  SiteTransferBundleOptions,
  SiteTransferBundleResult,
} from './management/site-transfer-bundle-service.types';
export {
  ManifestValidator,
  PluginManifestSchema,
  RegistryPluginSchema,
  RegistryManifestSchema
} from './management/manifest';
export type { RegistryPlugin, RegistryManifest } from './management/manifest.types';
export { MigrationCoordinator } from './management/migration-coordinator';
export { HotReloadService } from './management/hot-reload-service';
export { SystemUpdateService } from './management/system-update-service';

// Base Classes for Plugin Development
export { BaseRepository, BaseService, BaseController } from './base';
export { BaseRouter } from './base/base-router';
export { CollectionIdentityService } from './services/collection-identity-service';
export { MediaRelationService } from './services/media-relation-service';
