import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { ExtensionScope } from '@core/plugin/enums/extension-scope.enum';
import type { IFromcodePlugin } from '@core/interfaces/fromcode-plugin.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginContext } from '@core/plugin/plugin-context';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';
import type { ICollection } from '@core/collections/interfaces/collection.interface';
import { PluginHostRegistry } from '@core/plugin/host/plugin-host-registry';

import { HookManager } from '@core/hooks/hook-manager';
import type { QueueManager } from '@fromcode119/queue';
import { QueueSettingsReader } from '@core/queue/queue-settings-reader';
import { SchemaManager } from '@core/database/schema-manager';
import { MigrationManager } from '@core/database/migration-manager';
import { TenantMode } from '@core/tenant/tenant-mode';
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
import { RuntimeService } from '@core/plugin/services/runtime/runtime-service';
import { PluginStateService } from '@core/plugin/services/runtime/plugin-state-service';
import { DiscoveryService } from '@core/plugin/services/installation/discovery-service';
import { AdminMetadataService } from '@core/plugin/services/admin/admin-metadata-service';
import { LifecycleService } from '@core/plugin/services/runtime/lifecycle-service';
import { MiddlewareManager } from '@core/plugin/services/runtime/middleware-manager';
import { WorkflowService } from '@core/plugin/services/workflow-service';
import { WebhookService } from '@core/webhook/webhook-service';
import { PluginRegistry } from '@fromcode119/plugins';
import { IntegrationManager } from '@core/integrations';
import { Plugins } from '@core/plugin/plugins';
import { PluginsManagerResolver } from '@core/plugin/plugins-manager-resolver';
import { PluginTelemetryService } from '@core/plugin/services/health/plugin-telemetry-service';
import { PluginScaffoldService } from '@core/plugin/services/installation/plugin-scaffold-service';
import { PluginAdminRuntimeService } from '@core/plugin/services/admin/plugin-admin-runtime-service';
import { PluginInstallationService } from '@core/plugin/services/installation/plugin-installation-service';
import { PluginRuntimeStateService } from '@core/plugin/services/runtime/plugin-runtime-state-service';
import { PluginManagerInitService } from '@core/plugin/services/runtime/plugin-manager-init-service';
import { PluginDiscoveryCoordinatorService } from '@core/plugin/services/installation/plugin-discovery-coordinator-service';
import { PluginManagerShutdownService } from '@core/plugin/services/runtime/plugin-manager-shutdown-service';
import { PluginExtensionArchiveInstaller } from '@core/plugin/services/installation/plugin-extension-archive-installer';
import { PluginManagerServiceFactory } from '@core/plugin/services/runtime/plugin-manager-service-factory';
import { StorefrontRendererRefreshService } from '@core/management/storefront-renderer-refresh-service';
import { PluginManagerQueryService } from '@core/plugin/services/runtime/plugin-manager-query-service';
import type { IScaffoldPluginInput } from '@core/plugin/services/interfaces/scaffold-plugin-input.interface';
import type { IScaffoldPluginResult } from '@core/plugin/services/interfaces/scaffold-plugin-result.interface';
import { PluginManagerApi } from '@core/plugin/plugin-manager-api';
import { PluginManagerExtensions } from '@core/plugin/plugin-manager-extensions';

export class PluginManager extends PluginManagerExtensions, PluginManagerApi implements IPluginManagerInterface {
  /**
   * The fields live in {@link PluginManagerState}, declared once for both halves. Only what cannot
   * be declared there stays here: the static, and the getters that forward to `integrations`.
   */
  /** Emitted after `discoverPlugins()` has registered and enabled the whole boot set. */
  static readonly PLUGINS_READY_EVENT = 'plugins:ready';

  /**
   * The DDL connection: migrations and collection schema sync. Runs as the schema OWNER, which
   * `db` deliberately does not — see DatabaseConnectionUrls. Identical to `db` when the deployment
   * has not separated the roles.
   */

  /** The opt-outable email streams plugins have declared — what the account preferences screen lists. */

  /**
   * Set by the API bootstrap once the ThemeManager exists — see {@link setThemeManager}. Every plugin's
   * `context.theme.*` (active slug, config, per-plugin theme settings) resolves through this, as does the
   * theme-scoped i18n key and the active theme's default-page overrides. Null until wired, and the
   * context then reports NO theme rather than inventing one.
   */
  
  /** T5: the isolated plugins' processes. Built before discovery, which is what asks it to describe a plugin. */

  public get storage() { return this.integrations.storage; }
  public get email() { return this.integrations.email; }
  public get cache() { return this.integrations.cache; }
  public get jobs(): QueueManager { return this.integrations.queue; }

  // Core Extension System

  /**
   * Hands a plugin its context — and therefore the WHOLE manager.
   *
   * Stays on `PluginManager` rather than either half for exactly that reason: `PluginContextFactory`
   * takes an `IPluginManagerInterface`, which only the assembled class satisfies. A half is a half.
   */
  createContext(plugin: ILoadedPlugin): PluginContext {
    return PluginContextFactory.createPluginContext(plugin, this, this.logger);
  }

  constructor() {
    super();
    // The fields the class used to initialise INLINE. They moved here when the declarations moved to
    // `PluginManagerState`, which only `declare`s and therefore emits nothing — an initialiser left
    // on a `declare` would simply not run, which is how `hooks` arrived undefined and the constructor
    // threw on `this.hooks.on('*')`.
    this.plugins = new Map();
    this.apiHost = null;
    this.hooks = new HookManager();
    this.emailCategories = new EmailCategoryRegistry();
    this.middlewares = new MiddlewareManager();
    this.auth = null;
    this.themeManager = null;
    this.headInjections = new Map();
    this.logger = new Logger({ namespace: 'plugin-manager' });
    this.registeredCollections = new Map();
    this.pluginSettings = new Map();
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
    await this.bootstrap.configureTenantMode();
    // AFTER tenancy is known, never before: these rows are tenant-scoped, and seeding them while
    // TenantMode was still off wrote them with no tenant, which row-level security refuses outright.
    await this.bootstrap.seedPeopleCatalogs();
    // After migrations, so `_system_meta` exists: the queue's retry, backoff and retention policy is
    // the operator's, not a constant. Until this runs the declared defaults apply.
    this.scheduler.useQueue(this.jobs);
    this.jobs.applySettings(await QueueSettingsReader.read(this.db));
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
    // AFTER discovery, so every cross-plugin `collections.extend()` has already happened — a field
    // one plugin injects into another's collection must not be read as an orphan.
    const active = [...this.plugins.values()].filter((plugin) => plugin.state === PluginState.ACTIVE).map((plugin) => plugin.manifest.slug);
    this.hooks.emit(PluginManager.PLUGINS_READY_EVENT, { plugins: active });

    // AFTER `plugins:ready`, not before. A plugin declares a field conditionally on a PEER
    // (`if (licensingApi) fields.push(...)`), and a peer is only resolvable once it has booted — so
    // a sweep that runs earlier sees a field that is genuinely declared, by an ACTIVE plugin, as
    // undeclared. That finding would carry an EMPTY `inactivePluginsAtScan`, which is documented to
    // mean "the picture was complete" — a false positive with its safety caveat missing, which is
    // worse than one that has it.
    await this.bootstrap.auditUndeclaredColumns();
  }

}