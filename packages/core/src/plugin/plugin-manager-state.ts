import type { ICollection } from '@core/collections/interfaces/collection.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { ThemeManager } from '@core/theme/theme-manager';
import { AdminMetadataService } from '@core/plugin/services/admin/admin-metadata-service';
import { AuditManager } from '@core/security/audit-manager';
import { CoreExtensionManager } from '@core/extensions/extension-manager';
import { DatabaseFactory, DatabaseConnectionUrls, IDatabaseManager } from '@fromcode119/database';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';
import { HookManager } from '@core/hooks/hook-manager';
import { I18nManager } from '@core/i18n/i18n-manager';
import { IntegrationManager } from '@core/integrations';
import { LifecycleService } from '@core/plugin/services/runtime/lifecycle-service';
import { MarketplaceCatalogService } from '@core/marketplace/marketplace-catalog-service';
import { MiddlewareManager } from '@core/plugin/services/runtime/middleware-manager';
import { MigrationCoordinator } from '@core/management/migration-coordinator';
import { MigrationManager } from '@core/database/migration-manager';
import { PluginAdminRuntimeService } from '@core/plugin/services/admin/plugin-admin-runtime-service';
import { PluginDiscoveryCoordinatorService } from '@core/plugin/services/installation/plugin-discovery-coordinator-service';
import { PluginExtensionArchiveInstaller } from '@core/plugin/services/installation/plugin-extension-archive-installer';
import { PluginHostRegistry } from '@core/plugin/host/plugin-host-registry';
import { PluginInstallationService } from '@core/plugin/services/installation/plugin-installation-service';
import { PluginManagerInitService } from '@core/plugin/services/runtime/plugin-manager-init-service';
import { PluginManagerQueryService } from '@core/plugin/services/runtime/plugin-manager-query-service';
import { PluginManagerShutdownService } from '@core/plugin/services/runtime/plugin-manager-shutdown-service';
import { PluginRuntimeStateService } from '@core/plugin/services/runtime/plugin-runtime-state-service';
import { PluginScaffoldService } from '@core/plugin/services/installation/plugin-scaffold-service';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import { PluginTelemetryService } from '@core/plugin/services/health/plugin-telemetry-service';
import { RuntimeService } from '@core/plugin/services/runtime/runtime-service';
import { SchedulerService } from '@fromcode119/scheduler';
import { SchemaManager } from '@core/database/schema-manager';
import { SecurityMonitor } from '@core/security/security-monitor';
import { WebhookService } from '@core/webhook/webhook-service';
import { WorkflowService } from '@core/plugin/services/workflow-service';

/**
 * Everything `PluginManager` holds, declared once for the whole chain that works on it.
 *
 * `declare` throughout: these emit NOTHING. `PluginManagerState` → `PluginManagerExtensions` →
 * `PluginManagerApi` → `PluginManager`, and only the leaf owns the real fields and their
 * construction; each link above says only that they exist and what shape they are. A field both
 * declared AND initialised at two levels would be constructed twice.
 *
 * Visibility is carried across as it was: what was public on the manager stays public here, because
 * plugins and the api reach `manager.db`, `manager.hooks`, `manager.plugins` and the rest by name.
 * What was private becomes protected — the links need it, nothing outside does.
 */
export abstract class PluginManagerState {
  public declare audit: AuditManager;
  public declare security: SecurityMonitor;
  public declare marketplace: MarketplaceCatalogService;
  public declare plugins: Map<string, ILoadedPlugin>;
  public declare apiHost: any;
  public declare hooks: HookManager;
  public declare db: IDatabaseManager;
  public declare schemaDb: IDatabaseManager;
  public declare scheduler: SchedulerService;
  public declare i18n: I18nManager;
  public declare emailCategories: any;
  public declare integrations: IntegrationManager;
  public declare middlewares: MiddlewareManager;
  public declare auth: any;
  public declare themeManager: ThemeManager | null;
  public declare webhooks: WebhookService;
  public declare headInjections: Map<string, any[]>;
  public declare logger: any;
  public declare registeredCollections: Map<string, { collection: ICollection; pluginSlug: string }>;
  public declare pluginSettings: Map<string, any>;
  protected declare coordinator: MigrationCoordinator;
  public declare schemaManager: SchemaManager;
  protected declare migrationManager: MigrationManager;
  public declare projectRoot: string;
  public declare pluginHosts: PluginHostRegistry;
  public declare pluginsRoot: string;
  public declare runtime: RuntimeService;
  public declare registry: PluginStateService;
  protected declare discovery: DiscoveryService;
  protected declare admin: AdminMetadataService;
  protected declare lifecycle: LifecycleService;
  protected declare workflow: WorkflowService;
  protected declare telemetry: PluginTelemetryService;
  protected declare scaffold: PluginScaffoldService;
  protected declare adminRuntime: PluginAdminRuntimeService;
  protected declare installation: PluginInstallationService;
  protected declare runtimeState: PluginRuntimeStateService;
  protected declare bootstrap: PluginManagerInitService;
  protected declare discoveryCoordinator: PluginDiscoveryCoordinatorService;
  protected declare shutdownService: PluginManagerShutdownService;
  protected declare archiveInstaller: PluginExtensionArchiveInstaller;
  protected declare query: PluginManagerQueryService;
  public declare extensions: CoreExtensionManager;
}
