// Types
export * from './types';
export { RecordVersions } from './collections/record-versions';

// Core Classes (Server-only)
export { PluginManager } from './plugin/plugin-manager';
export type { PluginManagerInterface } from './plugin/context/utils.interfaces';
export { ThemeManager } from './theme/theme-manager';
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

// Shared Utilities
export { Logger } from '@fromcode119/sdk';
export type { LoggerOptions } from '@fromcode119/sdk';
export * from './utils';
// Re-export SystemConstants for external plugins
export { SystemConstants } from '@fromcode119/sdk';
export { EnvConfig } from './config/env';
export { ProjectPaths } from './config/paths';

// Integrations
export { IntegrationManager } from './integrations/integration-manager';
export { IntegrationRegistry } from './integrations/integration-registry';

// Context
export { RequestContextUtils } from './context/request-context';
export type { RequestStore } from './context/request-context.interfaces';

// Plugin Services (Server-only)
export { DiscoveryService } from './plugin/services/discovery-service';
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
