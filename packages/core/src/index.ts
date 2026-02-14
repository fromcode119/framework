export * from './types';
export { RecordVersions } from './collections/record-versions';
export { MediaCollection as Media } from '@fromcode/media';
export { PluginManager, type PluginManagerInterface } from './plugin/plugin-manager';
export { ThemeManager } from './theme/theme-manager';
export { SchemaManager } from './database/schema-manager';
export { MigrationManager } from './database/migration-manager';
export { Seeder } from './database/seeder';
export { HookManager } from './hooks/hook-manager';
export { HookAdapterFactory } from './hooks/hook-adapter-factory';
export { QueueManager } from './queue/queue-manager';
export { QueueAdapterFactory } from './queue/queue-adapter-factory';
export { LogLevel, Logger } from './logging/logger';
export type { LoggerOptions } from './logging/logger';
export { I18nManager } from './i18n/i18n-manager';
export * from './utils';
export { env, validateEnv } from './config/env';
export { WebSocketManager } from './realtime/web-socket-manager';

// Integrations
export { IntegrationManager } from './integrations/integration-manager';
export { IntegrationRegistry } from './integrations/integration-registry';
export { EmailIntegrationDefinition } from './integrations/providers/email-provider';

// Context
export { requestContext, getLocale } from './context/request-context';
export type { RequestStore } from './context/request-context';

// Plugin Services
export { DiscoveryService } from './plugin/services/discovery-service';
export { PluginStateService } from './plugin/services/plugin-state-service';
export { MarketplaceCatalogService } from './marketplace/marketplace-catalog-service';
export { RuntimeService } from './plugin/services/runtime-service';
export { LifecycleService } from './plugin/services/lifecycle-service';
export { AdminMetadataService } from './plugin/services/admin-metadata-service';

// Security
export { AuditManager } from './security/audit-manager';
export { SecurityMonitor } from './security/security-monitor';
export { PluginPermissionsService } from './security/plugin-permissions-service';
export type { PluginPermission } from './security/plugin-permissions-service';
export { PluginSignatureService, signPayload } from './security/plugin-signature-service';

// Management
export { BackupService } from './management/backup-service';
export {
  PluginManifestSchema,
  validatePluginManifest,
  safeValidatePluginManifest,
  RegistryPluginSchema,
  RegistryManifestSchema,
  validateRegistryManifest
} from './management/manifest';
export type { RegistryPlugin, RegistryManifest } from './management/manifest';
export { MigrationCoordinator } from './management/migration-coordinator';
export { HotReloadService } from './management/hot-reload-service';
export { SystemUpdateService } from './management/system-update-service';
