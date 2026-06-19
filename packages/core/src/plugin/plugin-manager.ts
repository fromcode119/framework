import { FromcodePlugin, LoadedPlugin, PluginContext, PluginManifest, Collection } from '../types';
import { SystemConstants } from '../constants';
import { HookManager } from '../hooks/hook-manager';
import { QueueManager } from '../queue/queue-manager';
import { SchemaManager } from '../database/schema-manager';
import { MigrationManager } from '../database/migration-manager';
import { Logger } from '../logging';
import { I18nManager } from '../i18n/i18n-manager';
import { DatabaseFactory, IDatabaseManager } from '@fromcode119/database';
import { SchedulerService } from '@fromcode119/scheduler';
import { MigrationCoordinator } from '../management/migration-coordinator';
import { AuditManager } from '../security/audit-manager';
import { SecurityMonitor } from '../security/security-monitor';
import { MarketplaceCatalogService } from '../marketplace/marketplace-catalog-service';
import { PluginContextFactory } from './context';
import type { PluginInstallProgressReporter } from './plugin-installation.interfaces';
import type { PluginManagerInterface } from './context/utils.interfaces';
import { CoreExtensionManager } from '../extensions/extension-manager';
import { ProjectPaths } from '../config/paths';

// Services
import { RuntimeService } from './services/runtime-service';
import { PluginStateService } from './services/plugin-state-service';
import { DiscoveryService } from './services/discovery-service';
import { AdminMetadataService } from './services/admin-metadata-service';
import { LifecycleService } from './services/lifecycle-service';
import { MiddlewareManager } from './services/middleware-manager';
import { WorkflowService } from './services/workflow-service';
import { WebhookService } from '../webhook/webhook-service';
import { PluginRegistry } from '@fromcode119/plugins';
import { IntegrationManager } from '../integrations';
import { Plugins } from '../plugins';
import { PluginsManagerResolver } from '../plugins-manager-resolver';
import { PluginTelemetryService } from './services/plugin-telemetry-service';
import { PluginScaffoldService } from './services/plugin-scaffold-service';
import { PluginAdminRuntimeService } from './services/plugin-admin-runtime-service';
import { PluginInstallationService } from './services/plugin-installation-service';
import { PluginRuntimeStateService } from './services/plugin-runtime-state-service';
import { PluginManagerInitService } from './services/plugin-manager-init-service';
import { PluginDiscoveryCoordinatorService } from './services/plugin-discovery-coordinator-service';
import { PluginManagerShutdownService } from './services/plugin-manager-shutdown-service';
import { PluginExtensionArchiveInstaller } from './services/plugin-extension-archive-installer';
import { PluginManagerServiceFactory } from './services/plugin-manager-service-factory';
import { PluginManagerQueryService } from './services/plugin-manager-query-service';
import type { ScaffoldPluginInput, ScaffoldPluginResult } from './services/plugin-scaffold-service.interfaces';

export class PluginManager implements PluginManagerInterface {
  public audit: AuditManager;
  public security: SecurityMonitor;
  public marketplace: MarketplaceCatalogService;
  public plugins: Map<string, LoadedPlugin> = new Map();
  public apiHost: any = null;
  public hooks: HookManager = new HookManager();
  public db: IDatabaseManager;
  public jobs!: QueueManager;
  public scheduler!: SchedulerService;
  public i18n!: I18nManager;
  public integrations: IntegrationManager;

  public middlewares: MiddlewareManager = new MiddlewareManager();
  public auth: any = null;
  public webhooks: WebhookService;
  public headInjections: Map<string, any[]> = new Map();
  public logger = new Logger({ namespace: 'plugin-manager' });
  public registeredCollections: Map<string, { collection: Collection; pluginSlug: string }> = new Map();
  public pluginSettings: Map<string, any> = new Map();
  
  private coordinator: MigrationCoordinator;
  public schemaManager: SchemaManager;
  private migrationManager: MigrationManager;
  public projectRoot: string;
  public pluginsRoot: string;

  public runtime: RuntimeService;
  public registry: PluginStateService;
  private discovery: DiscoveryService;
  private admin: AdminMetadataService;
  private lifecycle: LifecycleService;
  private workflow: WorkflowService;
  private telemetry!: PluginTelemetryService;
  private scaffold!: PluginScaffoldService;
  private adminRuntime: PluginAdminRuntimeService;
  private installation: PluginInstallationService;
  private runtimeState: PluginRuntimeStateService;
  private bootstrap: PluginManagerInitService;
  private discoveryCoordinator: PluginDiscoveryCoordinatorService;
  private shutdownService: PluginManagerShutdownService;
  private archiveInstaller: PluginExtensionArchiveInstaller;
  private query: PluginManagerQueryService;
  public get storage() { return this.integrations.storage; }
  public get email() { return this.integrations.email; }
  public get cache() { return this.integrations.cache; }

  // Core Extension System
  public extensions: CoreExtensionManager;

  constructor() {
    this.projectRoot = ProjectPaths.getProjectRoot();
    this.db = DatabaseFactory.create(process.env.DATABASE_URL || '');
    this.integrations = new IntegrationManager(this.db as any, this.projectRoot, this.logger);
    this.audit = new AuditManager(this.db);
    this.security = new SecurityMonitor(this.db, this);
    this.coordinator = new MigrationCoordinator(this.db);
    this.schemaManager = new SchemaManager(this.db);
    this.migrationManager = new MigrationManager(this.db);
    this.i18n = new I18nManager(process.env.DEFAULT_LOCALE || 'en');
    this.jobs = new QueueManager({ redisUrl: process.env.REDIS_URL });
    this.scheduler = new SchedulerService(this.db, { queueManager: this.jobs });
    this.workflow = new WorkflowService(this.db, this.hooks);
    this.webhooks = new WebhookService(this.db, this.hooks);
    // Forward every emitted hook event to the webhook dispatcher.
    this.hooks.on('*', (payload: any, event: string) => {
      this.webhooks.processEvent(event, payload).catch(err => this.logger.error(`Webhook delivery failed for ${event}:`, err));
    });

    // Initialize Global Plugin Registry for cohesion
    PluginRegistry.setDatabase(this.db);
    Plugins.setResolver(new PluginsManagerResolver(this.plugins));

    this.pluginsRoot = ProjectPaths.getPluginsDir();

    // Build the refactored collaborator-service graph (see factory for wiring).
    const services = PluginManagerServiceFactory.build(this, {
      migrationManager: this.migrationManager,
      coordinator: this.coordinator,
      workflow: this.workflow,
    });
    this.runtime = services.runtime;
    this.registry = services.registry;
    this.discovery = services.discovery;
    this.marketplace = services.marketplace;
    this.admin = services.admin;
    this.lifecycle = services.lifecycle;
    this.adminRuntime = services.adminRuntime;
    this.runtimeState = services.runtimeState;
    this.installation = services.installation;
    this.telemetry = services.telemetry;
    this.scaffold = services.scaffold;
    this.extensions = services.extensions;
    this.bootstrap = services.bootstrap;
    this.discoveryCoordinator = services.discoveryCoordinator;
    this.shutdownService = services.shutdownService;
    this.archiveInstaller = services.archiveInstaller;
    this.query = new PluginManagerQueryService(this.logger, this.db, this.discovery, this.plugins);
  }

  async init() {
    await this.bootstrap.init();
  }

  async discoverPlugins() {
    await this.discoveryCoordinator.discoverPlugins();
  }

  async updatePlugin(slug: string, pkg?: any): Promise<void> {
    await this.installOrUpdateFromMarketplace(slug);
  }

  async installOrUpdateFromMarketplace(
    slug: string,
    options: { enable?: boolean; progressReporter?: PluginInstallProgressReporter; version?: string } = {},
  ): Promise<PluginManifest> {
    return this.installation.installOrUpdateFromMarketplace(slug, options);
  }

  async installUploadedPluginArchive(
    filePath: string,
    options: { enable?: boolean; progressReporter?: PluginInstallProgressReporter } = {},
  ): Promise<PluginManifest> {
    return this.installation.installUploadedPluginArchive(filePath, options);
  }

  setThemeArchiveInstaller(installer: (filePath: string, options?: { activate?: boolean }) => Promise<any>): void {
    this.archiveInstaller.setThemeArchiveInstaller(installer);
  }

  setCoreArchiveInstaller(installer: (filePath: string) => Promise<any>): void {
    this.archiveInstaller.setCoreArchiveInstaller(installer);
  }

  async installExtensionArchive(
    filePath: string,
    type: 'plugin' | 'theme' | 'core',
    options: { enable?: boolean; activate?: boolean } = {},
  ): Promise<any> {
    return this.archiveInstaller.installExtensionArchive(filePath, type, options);
  }

  async shutdown() {
    return this.shutdownService.shutdown();
  }

  // Delegate Lifecycle
  async enable(slug: string, options: { force?: boolean, recursive?: boolean } = {}) { return this.lifecycle.enable(slug, options); }
  async disable(slug: string, options: { persistState?: boolean } = {}) { return this.lifecycle.disable(slug, options); }
  async delete(slug: string) { return this.lifecycle.delete(slug); }
  async register(plugin: FromcodePlugin, path?: string) { return this.lifecycle.register(plugin, path); }

  async scaffoldPlugin(input: ScaffoldPluginInput): Promise<ScaffoldPluginResult> {
    return this.scaffold.scaffoldPlugin(input);
  }

    async writeLog(level: string, message: string, pluginSlug?: string, context?: any) {
    await this.registry.writeLog(level, message, pluginSlug, context);
    this.telemetry.notifyOnCriticalLog(level, message, pluginSlug, context).catch((error: any) => {
      this.logger.warn("Email telemetry alert dispatch failed: " + (error?.message || error));
    });
  }

  async sendWeeklyEmailTelemetryDigest(): Promise<void> {
    return this.telemetry.sendWeeklyEmailTelemetryDigest();
  }

  public async sendTestEmailTelemetry(triggeredBy?: { id?: string | number; email?: string; roles?: string[] }): Promise<{ sent: boolean; recipientsCount: number }> {
    return this.telemetry.sendTestEmailTelemetry(triggeredBy);
  }

    async savePluginConfig(slug: string, config: any) {
    await this.runtimeState.savePluginConfig(slug, config);
  }

  async saveSandboxConfig(slug: string, config: any) {
    await this.runtimeState.saveSandboxConfig(slug, config);
  }

  public getHeadInjections(slug: string): any[] {
    return this.runtimeState.getHeadInjections(slug);
  }

  getCollections() {
    return this.runtimeState.getCollections();
  }

  getCollection(slug: string) {
    return this.runtimeState.getCollection(slug);
  }

  public registerPluginSettings(pluginSlug: string, schema: any): void {
    this.runtimeState.registerPluginSettings(pluginSlug, schema);
  }

  public getPluginSettings(pluginSlug: string): any | undefined {
    return this.runtimeState.getPluginSettings(pluginSlug);
  }

  public getAllPluginSettings(): Map<string, any> {
    return this.runtimeState.getAllPluginSettings();
  }

  public async getPublicFrontendPluginSettings(): Promise<Record<string, Record<string, any>>> {
    return this.query.getPublicFrontendPluginSettings((slug: string) => this.getPluginSettings(slug));
  }

  async installFromZip(filePath: string, pluginsRoot?: string): Promise<PluginManifest> {
    return this.discovery.installFromZip(filePath);
  }

  async finalizeInstalledPlugin(
    slug: string,
    options: { enable?: boolean; progressReporter?: PluginInstallProgressReporter } = {},
  ): Promise<void> {
    await this.installation.finalizeInstalledPlugin(slug, options);
  }

  async disableWithError(slug: string, message: string): Promise<void> {
    await this.runtimeState.disableWithError(slug);
  }

  public async getSecuritySummary() {
    return this.adminRuntime.getSecuritySummary();
  }

  /** Returns plugins in topological order based on their dependencies. */
  public getSortedPlugins(pluginsToSort?: LoadedPlugin[]): LoadedPlugin[] {
    return this.query.getSortedPlugins(pluginsToSort);
  }

  getRuntimeModules() { return this.adminRuntime.getRuntimeModules(); }
  async getAdminMetadata() {
    return this.adminRuntime.getAdminMetadata(() => this.getSortedPlugins());
  }

  getImportMap() {
    return this.adminRuntime.getImportMap();
  }

  createContext(plugin: LoadedPlugin): PluginContext { return PluginContextFactory.createPluginContext(plugin, this, this.logger); }
  getPlugins(): LoadedPlugin[] { return Array.from(this.plugins.values()); }
  setAuth(auth: any) { this.auth = auth; }
  setApiHost(host: any) { this.apiHost = host; }

  emit(event: string, payload: any) { 
    this.hooks.emit(event, payload);
  }

  async close() {
    return this.shutdownService.close();
  }
}
