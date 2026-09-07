import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import type { IFromcodePlugin } from '@core/interfaces/fromcode-plugin.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginContext } from '@core/plugin-context';
import type { IPluginManifest } from '@core/interfaces/plugin-manifest.interface';
import type { ICollection } from '@core/interfaces/collection.interface';
import { PluginHostRegistry } from '@core/plugin/host/plugin-host-registry';

import { HookManager } from '@core/hooks/hook-manager';
import type { QueueManager } from '@fromcode119/queue';
import { QueueSettingsReader } from '@core/queue/queue-settings-reader';
import { SchemaManager } from '@core/database/schema-manager';
import { MigrationManager } from '@core/database/migration-manager';
import { DatabaseRoleGuard } from '@core/tenant/database-role-guard';
import { TenantMode } from '@core/tenant/tenant-mode';
import { PluginTenantAccess } from '@core/plugin/tenant/plugin-tenant-access';
import { SystemConstants } from '@core/constants/system.constants';
import { Logger } from '@core/logging';
import { I18nManager } from '@core/i18n/i18n-manager';
import { EmailCategoryRegistry } from '@core/email/email-category-registry';
import { DatabaseFactory, DatabaseConnectionUrls, IDatabaseManager } from '@fromcode119/database';
import { SchedulerService } from '@fromcode119/scheduler';
import { MigrationCoordinator } from '@core/management/migration-coordinator';
import { AuditManager } from '@core/security/audit-manager';
import { SecurityMonitor } from '@core/security/security-monitor';
import { MarketplaceCatalogService } from '@core/marketplace/marketplace-catalog-service';
import { PluginContextFactory } from '@core/plugin/context';
import type { IPluginInstallProgressReporter } from '@core/plugin/interfaces/plugin-install-progress-reporter.interface';
import type { IPluginManagerInterface } from '@core/plugin/context/interfaces/plugin-manager-interface.interface';
import { CoreExtensionManager } from '@core/extensions/extension-manager';
import { ProjectPaths } from '@core/config/paths';
import type { ThemeManager } from '@core/theme/theme-manager';

// Services
import { RuntimeService } from '@core/plugin/services/runtime-service';
import { PluginStateService } from '@core/plugin/services/plugin-state-service';
import { DiscoveryService } from '@core/plugin/services/discovery-service';
import { AdminMetadataService } from '@core/plugin/services/admin-metadata-service';
import { LifecycleService } from '@core/plugin/services/lifecycle-service';
import { MiddlewareManager } from '@core/plugin/services/middleware-manager';
import { WorkflowService } from '@core/plugin/services/workflow-service';
import { WebhookService } from '@core/webhook/webhook-service';
import { PluginRegistry } from '@fromcode119/plugins';
import { IntegrationManager } from '@core/integrations';
import { Plugins } from '@core/plugins';
import { PluginsManagerResolver } from '@core/plugins-manager-resolver';
import { PluginTelemetryService } from '@core/plugin/services/plugin-telemetry-service';
import { PluginScaffoldService } from '@core/plugin/services/plugin-scaffold-service';
import { PluginAdminRuntimeService } from '@core/plugin/services/plugin-admin-runtime-service';
import { PluginInstallationService } from '@core/plugin/services/plugin-installation-service';
import { PluginRuntimeStateService } from '@core/plugin/services/plugin-runtime-state-service';
import { PluginManagerInitService } from '@core/plugin/services/plugin-manager-init-service';
import { PluginDiscoveryCoordinatorService } from '@core/plugin/services/plugin-discovery-coordinator-service';
import { PluginManagerShutdownService } from '@core/plugin/services/plugin-manager-shutdown-service';
import { PluginExtensionArchiveInstaller } from '@core/plugin/services/plugin-extension-archive-installer';
import { PluginManagerServiceFactory } from '@core/plugin/services/plugin-manager-service-factory';
import { StorefrontRendererRefreshService } from '@core/management/storefront-renderer-refresh-service';
import { PluginManagerQueryService } from '@core/plugin/services/plugin-manager-query-service';
import type { IScaffoldPluginInput } from '@core/plugin/services/interfaces/scaffold-plugin-input.interface';
import type { IScaffoldPluginResult } from '@core/plugin/services/interfaces/scaffold-plugin-result.interface';

export class PluginManager implements IPluginManagerInterface {
  /** Emitted after `discoverPlugins()` has registered and enabled the whole boot set. */
  static readonly PLUGINS_READY_EVENT = 'plugins:ready';

  public audit: AuditManager;
  public security: SecurityMonitor;
  public marketplace: MarketplaceCatalogService;
  public plugins: Map<string, ILoadedPlugin> = new Map();
  public apiHost: any = null;
  public hooks: HookManager = new HookManager();
  public db: IDatabaseManager;
  /**
   * The DDL connection: migrations and collection schema sync. Runs as the schema OWNER, which
   * `db` deliberately does not — see DatabaseConnectionUrls. Identical to `db` when the deployment
   * has not separated the roles.
   */
  public schemaDb: IDatabaseManager;
  public scheduler!: SchedulerService;
  public i18n!: I18nManager;

  /** The opt-outable email streams plugins have declared — what the account preferences screen lists. */
  public readonly emailCategories = new EmailCategoryRegistry();
  public integrations: IntegrationManager;

  public middlewares: MiddlewareManager = new MiddlewareManager();
  public auth: any = null;
  /**
   * Set by the API bootstrap once the ThemeManager exists — see {@link setThemeManager}. Every plugin's
   * `context.theme.*` (active slug, config, per-plugin theme settings) resolves through this, as does the
   * theme-scoped i18n key and the active theme's default-page overrides. Null until wired, and the
   * context then reports NO theme rather than inventing one.
   */
  public themeManager: ThemeManager | null = null;
  public webhooks: WebhookService;
  public headInjections: Map<string, any[]> = new Map();
  public logger = new Logger({ namespace: 'plugin-manager' });
  public registeredCollections: Map<string, { collection: ICollection; pluginSlug: string }> = new Map();
  public pluginSettings: Map<string, any> = new Map();
  
  private coordinator: MigrationCoordinator;
  public schemaManager: SchemaManager;
  private migrationManager: MigrationManager;
  public projectRoot: string;
  /** T5: the isolated plugins' processes. Built before discovery, which is what asks it to describe a plugin. */
  public pluginHosts: PluginHostRegistry;
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
  public get jobs(): QueueManager { return this.integrations.queue; }

  // Core Extension System
  public extensions: CoreExtensionManager;

  constructor() {
    this.projectRoot = ProjectPaths.getProjectRoot();
    this.pluginHosts = new PluginHostRegistry(this, this.projectRoot);
    // Two connections, deliberately. Requests run on the least-privilege runtime role so that
    // row-level security actually applies to them; DDL (migrations, collection schema sync) runs on
    // the role that OWNS the schema. A deployment that sets no DATABASE_MIGRATION_URL gets the same
    // connection for both, which is the correct single-tenant behaviour.
    this.db = DatabaseFactory.create(DatabaseConnectionUrls.runtime());
    this.schemaDb = DatabaseConnectionUrls.hasSeparateMigrationConnection()
      ? DatabaseFactory.create(DatabaseConnectionUrls.migration())
      : this.db;
    // The DDL connection acts for the PLATFORM: it writes schema fingerprints and migration
    // bookkeeping, which belong to no tenant. Without this the first boot after settings became
    // tenant-scoped dies on its own metadata write.
    //
    // On a deployment with no separate DDL connection this marks the single connection, and that is
    // correct rather than a hole: such a deployment is single-tenant (a multi-tenant one must split
    // the roles — the request role is a non-owner and cannot run DDL at all), and a single-tenant
    // install has to be able to write its own platform-level settings.
    this.schemaDb.markAsPlatformConnection();
    this.integrations = new IntegrationManager(this.db as any, this.projectRoot, this.logger);
    this.audit = new AuditManager(this.db);
    this.security = new SecurityMonitor(this.db, this);
    this.coordinator = new MigrationCoordinator(this.schemaDb);
    this.schemaManager = new SchemaManager(this.schemaDb);
    this.migrationManager = new MigrationManager(this.schemaDb);
    this.i18n = new I18nManager(process.env.DEFAULT_LOCALE || 'en');
    // The queue is the operator's `queue` integration, resolved during integrations.initialize(); the
    // scheduler is handed it there too. Constructing one from the environment here is what made the
    // running driver invisible to the admin.
    this.scheduler = new SchedulerService(this.db);
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
    await this.configureTenantMode();
    // After migrations, so `_system_meta` exists: the queue's retry, backoff and retention policy is
    // the operator's, not a constant. Until this runs the declared defaults apply.
    this.scheduler.useQueue(this.jobs);
    this.jobs.applySettings(await QueueSettingsReader.read(this.db));
  }

  /**
   * Decides once, after migrations have run, whether this deployment is multi-tenant — and refuses
   * to continue if it is multi-tenant on a driver that cannot isolate, or on a connection that
   * bypasses row-level security.
   *
   * Runs AFTER bootstrap because `_system_tenants` only exists once migration 020 has run. A
   * deployment with no tenant rows stays single-tenant and skips both checks: it behaves exactly as
   * it did before tenancy existed, on any driver.
   */
  private async configureTenantMode(): Promise<void> {
    // Failure to read the tenancy registry must stop startup. Treating a database error as
    // "zero tenants" silently disabled RLS checks and could start a multi-tenant deployment on
    // the privileged migration connection.
    const tenants = await this.schemaDb.count(SystemConstants.TABLE.TENANTS);

    TenantMode.configure({
      tenantCount: Number(tenants || 0),
      dialect: String(this.db.dialect || ''),
      isolationSupported: this.db.supportsTenantIsolation(),
    });

    // The tenant axis of plugin enablement reads on the REQUEST connection, like every other
    // per-request lookup — not the owner connection, which exists only for DDL.
    PluginTenantAccess.configure(this.db);

    // Only meaningful once tenants exist: a single-tenant deployment has nothing to isolate, and
    // demanding a least-privilege role there would break every existing installation.
    if (TenantMode.isEnabled()) {
      await DatabaseRoleGuard.assertNotPrivileged(this.db as any);
    }
  }

  /**
   * Boots every plugin, then announces `plugins:ready` ONCE the whole set is registered and enabled.
   *
   * A plugin's own onInit/onEnable run inside the boot loop, so a cross-plugin registration made
   * there (numerology → broadcasts provider) can only see the plugins that booted BEFORE it. Without
   * this event plugins resorted to setTimeout polling of the namespace. The payload lists the active
   * slugs so a handler can tell which peers exist without probing.
   */
  async discoverPlugins() {
    await this.discoveryCoordinator.discoverPlugins();
    // Every tenant-scoped table, not just the ones a registered collection happened to sync — a
    // table belonging to a disabled plugin would otherwise stay globally readable.
    await this.schemaManager.applyTenantIsolationSweep(this.systemCollectionTables());
    const active = [...this.plugins.values()].filter((plugin) => plugin.state === PluginState.ACTIVE).map((plugin) => plugin.manifest.slug);
    this.hooks.emit(PluginManager.PLUGINS_READY_EVENT, { plugins: active });
  }

  async updatePlugin(slug: string, pkg?: any): Promise<void> {
    await this.installOrUpdateFromMarketplace(slug);
  }

  async installOrUpdateFromMarketplace(
    slug: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter; version?: string } = {},
  ): Promise<IPluginManifest> {
    const manifest = await this.installation.installOrUpdateFromMarketplace(slug, options);
    await this.refreshStorefrontRenderer(`plugin "${slug}" installed/updated`);
    return manifest;
  }

  /** Update every installed plugin with a newer marketplace version — ONE restart at the end. */
  async updateAllFromMarketplace(
    options: { progressReporter?: IPluginInstallProgressReporter } = {},
  ): Promise<{ updated: string[]; failed: { slug: string; error: string }[] }> {
    const outcome = await this.installation.updateAllFromMarketplace(options);
    // ONE refresh for the whole batch, and only when something actually changed on disk.
    if (outcome.updated.length) {
      await this.refreshStorefrontRenderer(`plugins updated (${outcome.updated.join(', ')})`);
    }
    return outcome;
  }

  async installUploadedPluginArchive(
    filePath: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter } = {},
  ): Promise<IPluginManifest> {
    const manifest = await this.installation.installUploadedPluginArchive(filePath, options);
    await this.refreshStorefrontRenderer(`plugin "${manifest.slug}" installed from an archive`);
    return manifest;
  }

  /**
   * The storefront server-renders each plugin's `ui-ssr` bundle and holds it for the life of its
   * process, so a plugin whose files just changed keeps rendering from the previous copy until the
   * renderer restarts — silently, as empty values rather than an error. Same contract as the theme
   * side; never fatal (see {@link StorefrontRendererRefreshService}).
   */
  private async refreshStorefrontRenderer(reason: string): Promise<void> {
    await StorefrontRendererRefreshService.afterExtensionsChanged(reason, this.logger);
  }

  setThemeArchiveInstaller(installer: (filePath: string, options?: { activate?: boolean }) => Promise<any>): void {
    this.archiveInstaller.setThemeArchiveInstaller(installer);
  }

  setCoreArchiveInstaller(installer: (filePath: string) => Promise<any>): void {
    this.archiveInstaller.setCoreArchiveInstaller(installer);
  }

  async installExtensionArchive(
    filePath: string,
    type: ExtensionScope,
    options: { enable?: boolean; activate?: boolean } = {},
  ): Promise<any> {
    const outcome = await this.archiveInstaller.installExtensionArchive(filePath, type, options);
    // PLUGIN scope only: a theme archive is routed to the theme manager, which performs its own
    // refresh — refreshing here as well would restart the storefront twice for one install.
    if (ExtensionScope.resolve(type) === ExtensionScope.PLUGIN) {
      await this.refreshStorefrontRenderer('a plugin archive was installed');
    }
    return outcome;
  }

  async shutdown() {
    return this.shutdownService.shutdown();
  }

  // Delegate Lifecycle
  /**
   * Materialize the default pages of every plugin the CURRENT site runs (call inside that site's
   * tenant scope). This is what gives a newly created site its /shop, /login and friends — the boot
   * pass runs untenanted and cannot write a site's pages.
   */
  async materializeDefaultPages(): Promise<void> { return this.lifecycle.materializeDefaultPagesFinalPass(); }
  /** Every active plugin's seed data, for the site currently in scope. */
  async runPluginSeedsForCurrentSite(): Promise<string[]> { return this.lifecycle.runSeedsForCurrentSite(); }
  async enable(slug: string, options: { force?: boolean, recursive?: boolean } = {}) { return this.lifecycle.enable(slug, options); }
  async disable(slug: string, options: { persistState?: boolean } = {}) { return this.lifecycle.disable(slug, options); }
  async delete(slug: string) { return this.lifecycle.delete(slug); }
  async register(plugin: IFromcodePlugin, path?: string) { return this.lifecycle.register(plugin, path); }

  async scaffoldPlugin(input: IScaffoldPluginInput): Promise<IScaffoldPluginResult> {
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

  async installFromZip(filePath: string, pluginsRoot?: string): Promise<IPluginManifest> {
    return this.discovery.installFromZip(filePath);
  }

  async finalizeInstalledPlugin(
    slug: string,
    options: { enable?: boolean; progressReporter?: IPluginInstallProgressReporter } = {},
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
  public getSortedPlugins(pluginsToSort?: ILoadedPlugin[]): ILoadedPlugin[] {
    return this.query.getSortedPlugins(pluginsToSort);
  }

  getRuntimeModules() { return this.adminRuntime.getRuntimeModules(); }
  async getAdminMetadata() {
    return this.adminRuntime.getAdminMetadata(() => this.getSortedPlugins());
  }

  getImportMap() {
    return this.adminRuntime.getImportMap();
  }

  createContext(plugin: ILoadedPlugin): PluginContext { return PluginContextFactory.createPluginContext(plugin, this, this.logger); }
  getPlugins(): ILoadedPlugin[] { return Array.from(this.plugins.values()); }
  setAuth(auth: any) { this.auth = auth; }
  /**
   * The API boots the ThemeManager separately (it needs the manager's db) and MUST hand it back before
   * `discoverPlugins()`: plugins read `context.theme` in their onInit (the forms plugin builds its default
   * contact form from the theme's `contactFormDefaults` there). This hand-off was missing for every boot,
   * so `context.theme` was `{}` for every plugin and every theme-declared plugin default was ignored.
   */
  setThemeManager(themeManager: ThemeManager) { this.themeManager = themeManager; }
  setApiHost(host: any) { this.apiHost = host; }

  emit(event: string, payload: any) { 
    this.hooks.emit(event, payload);
  }

  async close() {
    return this.shutdownService.close();
  }

  /**
   * Physical tables belonging to collections declared `system: true` — framework configuration,
   * which is never tenant-scoped in T0 regardless of what the table is called.
   */
  private systemCollectionTables(): Set<string> {
    const tables = new Set<string>();
    for (const [, entry] of this.registeredCollections) {
      const collection: any = entry.collection;
      if (collection?.system !== true) continue;
      for (const name of [collection.tableName, collection.slug]) {
        if (name) tables.add(String(name).toLowerCase());
      }
    }
    return tables;
  }

}
