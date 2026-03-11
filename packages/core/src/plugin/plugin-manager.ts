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
import { BackupService } from '../management/backup-service';
import { MigrationCoordinator } from '../management/migration-coordinator';
import { RecordVersions } from '../collections/record-versions';
import { AuditManager } from '../security/audit-manager';
import { SecurityMonitor } from '../security/security-monitor';
import { MarketplaceCatalogService } from '../marketplace/marketplace-catalog-service';
import * as path from 'path';
import * as fs from 'fs';
import { PluginContextFactory } from './context';
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
import { WebhooksCollection } from '../collections/webhooks';
import { PluginRegistry } from '@fromcode119/plugins';
import { IntegrationManager } from '../integrations';
import { PluginTelemetryService } from './services/plugin-telemetry-service';
import { PluginScaffoldService } from './services/plugin-scaffold-service';

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

  // Refactored Services
  public runtime: RuntimeService;
  public registry: PluginStateService;
  private discovery: DiscoveryService;
  private admin: AdminMetadataService;
  private lifecycle: LifecycleService;
  private workflow: WorkflowService;
  private telemetry!: PluginTelemetryService;
  private scaffold!: PluginScaffoldService;
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

    this.pluginsRoot = ProjectPaths.getPluginsDir();

    // Initialize Services
    this.runtime = new RuntimeService(this.projectRoot);
    this.registry = new PluginStateService(this.db);
    this.discovery = new DiscoveryService(this.pluginsRoot, this.projectRoot);
    this.marketplace = new MarketplaceCatalogService(this.discovery);
    this.admin = new AdminMetadataService();
    this.lifecycle = new LifecycleService(this, this.registry, this.discovery, this.schemaManager);

    // Telemetry & scaffold services (email getter deferred so integrations are ready)
    this.telemetry = new PluginTelemetryService(this.db, () => this.email);
    this.scaffold = new PluginScaffoldService(
      this.logger,
      (slug) => this.plugins.has(slug),
      () => this.discoverPlugins(),
      (slug) => this.enable(slug),
    );

    // Initialize Core Extension System
    const packagesRoot = ProjectPaths.getPackagesDir();
    this.extensions = new CoreExtensionManager(this.db, packagesRoot, this.logger);
  }

  async init() {
    await this.migrationManager.migrate();
    await this.coordinator.validateDatabaseState();
    await this.integrations.initialize();
    
    // Discover and initialize core extensions BEFORE plugin initialization
    // This ensures extensions like AI can register integration types before plugins need them
    this.extensions.setServices({
      integrations: this.integrations,
      hooks: this.hooks,
      plugins: this,
    });
    
    try {
      await this.extensions.discover();
      await this.extensions.initializeAll();
      this.logger.info('Core extensions initialized');
    } catch (error) {
      this.logger.error('Failed to initialize core extensions:', error);
      // Don't fail startup if extensions fail - they're optional
    }
    
    // Register background workers - MUST happen after migrations but before scheduler starts
    this.jobs.registerWorker('scheduler', async (job) => {
      const { taskName } = job.data;
      await this.scheduler.runHandler(taskName);
    });

    // Register global content workflow task - MUST happen after migrations
    await this.scheduler.register('content-workflows', '2m', async () => {
      await this.workflow.processScheduledContent(this.getCollections());
    });
    await this.scheduler.register('system-email-telemetry-weekly', '0 9 * * 1', async () => {
      await this.sendWeeklyEmailTelemetryDigest();
    }, { type: 'cron' });
    
    // Register system collections
    this.registeredCollections.set('versions', { collection: RecordVersions.collection, pluginSlug: 'system' });
    this.registeredCollections.set('webhooks', { collection: WebhooksCollection.collection, pluginSlug: 'system' });
    
    for (const entry of Array.from(this.registeredCollections.values())) {
      if (entry.pluginSlug === 'system') await this.schemaManager.syncCollection(entry.collection);
    }

    await this.webhooks.initialize();

    // Start background services after migrations and system collections are ready
    await this.scheduler.start();
    this.security.start();
  }

  async discoverPlugins() {
    const installedState = await this.registry.loadInstalledPluginsState();
    const { discovered, errored } = await this.discovery.discoverPlugins(this.plugins, installedState);

    // Add errored plugins to this.plugins
    for (const error of errored) {
      if (!this.plugins.has(error.manifest.slug)) {
        this.plugins.set(error.manifest.slug, {
          manifest: error.manifest,
          path: error.path,
          state: 'error',
          error: error.error,
          instanceId: `err-${error.manifest.slug}-${Date.now()}`
        } as any);
      }
    }

    try {
      const sorted = this.discovery.resolveDependencies(discovered.map(d => d.plugin));
      await this.coordinator.coordinate(sorted.map(p => p.manifest));

      for (const plugin of sorted) {
        const slug = plugin.manifest.slug;
        const stage = discovered.find(d => d.plugin.manifest.slug === slug);
        
        if (!stage) {
          this.logger.warn(`Plugin metadata found for ${slug} but path discovery failed.`);
          continue;
        }

        const existing = this.plugins.get(slug);
        if (existing && existing.state !== 'error') {
          continue;
        }

        try {
          await this.lifecycle.register(plugin, stage.path);
        } catch (err: any) {
          this.logger.error(`Failed to register plugin "${slug}": ${err.message}`);
          // Mark as errored in the local registry so it shows up in UI
          this.plugins.set(slug, {
            manifest: plugin.manifest,
            path: stage.path,
            state: 'error',
            error: err.message,
            instanceId: `err-reg-${slug}-${Date.now()}`
          } as any);
        }
      }
    } catch (err: any) {
      this.logger.error(`Plugin discovery coordination failed: ${err.message}`);
    }
  }

  async updatePlugin(slug: string, pkg?: any): Promise<void> {
    await this.installOrUpdateFromMarketplace(slug);
  }

  async installOrUpdateFromMarketplace(slug: string): Promise<PluginManifest> {
    const pkg = await this.marketplace.getPluginInfo(slug);
    if (!pkg) throw new Error(`Plugin "${slug}" not found in marketplace.`);

    const existing = this.plugins.get(slug);
    if (existing && existing.path) {
      this.logger.info(`Creating backup for ${slug} before update...`);
      await BackupService.create(slug, existing.path, 'plugins');
    }

    const manifest = await this.marketplace.downloadAndInstall(slug);
    
    // Refresh discovery
    await this.discoverPlugins();
    
    // Auto-enable if it was previously active (or if it's new, we'll let the controller decide)
    if (existing?.state === 'active') {
      await this.enable(slug);
    }
    
    return manifest;
  }

  /**
   * Shuts down all active plugin manager services.
   */
  async shutdown() {
    this.logger.info('Shutting down PluginManager services...');
    
    if (this.scheduler) {
      await this.scheduler.stop();
    }
    
    if (this.security) {
      this.security.stop();
    }
    
    if (this.jobs) {
      await this.jobs.close();
    }
    
    if (this.webhooks) {
        // Any cleanup for webhooks?
    }

    this.logger.info('PluginManager shutdown complete.');
  }

  // Delegate Lifecycle
  async enable(slug: string, options: { force?: boolean, recursive?: boolean } = {}) { return this.lifecycle.enable(slug, options); }
  async disable(slug: string, options: { persistState?: boolean } = {}) { return this.lifecycle.disable(slug, options); }
  async delete(slug: string) { return this.lifecycle.delete(slug); }
  async register(plugin: FromcodePlugin, path?: string) { return this.lifecycle.register(plugin, path); }

  async scaffoldPlugin(input: {
    slug: string;
    name: string;
    description?: string;
    version?: string;
    activate?: boolean;
  }): Promise<{
    slug: string;
    name: string;
    path: string;
    activated: boolean;
    activationError: string | null;
    manifest: any;
  }> {
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
    await this.registry.savePluginConfig(slug, config);
    const plugin = this.plugins.get(slug);
    if (plugin) {
      plugin.manifest.config = config;
    }
  }

  async saveSandboxConfig(slug: string, config: any) {
    const { systemPlugins, eq } = require('@fromcode119/database');
    const isExplicitlyDisabled = config === false || (config && typeof config === 'object' && config.enabled === false);
    const normalizedConfig = isExplicitlyDisabled
      ? false
      : (config && typeof config === 'object'
          ? Object.fromEntries(Object.entries(config).filter(([key]) => key !== 'enabled'))
          : {});

    await (this.db as any).update(systemPlugins, { slug }, { 
      sandboxConfig: normalizedConfig 
    });
    
    const plugin = this.plugins.get(slug);
    if (plugin) {
      // Update manifest representation
      if (normalizedConfig === false) {
        plugin.manifest.sandbox = false;
      } else {
        if (!plugin.manifest.sandbox || typeof plugin.manifest.sandbox === 'boolean') {
          plugin.manifest.sandbox = normalizedConfig;
        } else {
          plugin.manifest.sandbox = { ...plugin.manifest.sandbox, ...normalizedConfig };
        }
      }
    }
    
    this.logger.info(`Sandbox configuration updated for plugin: ${slug}`);
  }

  public getHeadInjections(slug: string): any[] {
    return this.headInjections.get(slug.toLowerCase()) || [];
  }

  getCollections() {
    return Array.from(this.registeredCollections.values()).map(c => c.collection);
  }

  getCollection(slug: string) {
    const entry = this.registeredCollections.get(slug);
    if (entry) return entry;

    // Case-insensitive fallback
    const lowerSlug = slug.toLowerCase();
    for (const [key, val] of this.registeredCollections.entries()) {
      if (key.toLowerCase() === lowerSlug) return val;
    }
    
    return undefined;
  }

  public registerPluginSettings(pluginSlug: string, schema: any): void {
    this.pluginSettings.set(pluginSlug.toLowerCase(), schema);
    this.logger.info(`Settings registered for plugin: ${pluginSlug}`);
  }

  public getPluginSettings(pluginSlug: string): any | undefined {
    return this.pluginSettings.get(pluginSlug.toLowerCase());
  }

  public getAllPluginSettings(): Map<string, any> {
    return new Map(this.pluginSettings);
  }

  async installFromZip(filePath: string, pluginsRoot?: string): Promise<PluginManifest> {
    return this.discovery.installFromZip(filePath);
  }

  async disableWithError(slug: string, message: string): Promise<void> {
    const plugin = this.plugins.get(slug);
    if (plugin) {
      plugin.state = 'error';
      await this.db.update(SystemConstants.TABLE.PLUGINS, { slug }, { state: 'error', health_status: 'error', updated_at: new Date() });
    }
  }

  public async getSecuritySummary() {
    const all = this.getPlugins();
    const active = all.filter((p) => p.state === 'active');
    const isSandboxed = (p: LoadedPlugin) => p.manifest?.sandbox !== false;
    const mismatch = active.filter(isSandboxed).filter((p) => !p.isSandboxed);
    const sandbox = await this.lifecycle.getSandboxStats();
    const mem = process.memoryUsage();
    return {
      sandbox,
      hostMemory: { rssBytes: mem.rss, heapTotalBytes: mem.heapTotal, heapUsedBytes: mem.heapUsed, externalBytes: mem.external, arrayBuffersBytes: mem.arrayBuffers || 0, dbNetworkBuffersEstimateBytes: mem.arrayBuffers || 0, otherNonIsolateAllocationsEstimateBytes: Math.max(0, mem.rss - Number(sandbox?.heap?.used_heap_size || 0)) },
      monitor: await this.security.getSecurityStats(),
      pluginIsolation: { totalPlugins: all.length, activePlugins: active.length, sandboxConfiguredPlugins: all.filter(isSandboxed).length, sandboxActivePlugins: active.filter(isSandboxed).length, sandboxRuntimeActivePlugins: active.filter((p) => !!p.isSandboxed).length, sandboxPolicyRuntimeMismatchPlugins: mismatch.length, sandboxPolicyRuntimeMismatchSlugs: mismatch.map((p) => p.manifest.slug), unsandboxedActivePlugins: active.filter((p) => !isSandboxed(p)).length, unsandboxedActivePluginSlugs: active.filter((p) => !isSandboxed(p)).map((p) => p.manifest.slug) },
      integrityEnforced: true,
      signatureEnforced: !!process.env.REQUIRE_SIGNATURES
    };
  }

  /** Returns plugins in topological order based on their dependencies. */
  public getSortedPlugins(pluginsToSort?: LoadedPlugin[]): LoadedPlugin[] {
    const list = pluginsToSort || Array.from(this.plugins.values());
    try {
      return this.discovery.resolveDependencies(list as any) as LoadedPlugin[];
    } catch (err: any) {
      this.logger.warn(`Topological sort failed: ${err.message}. Returning unsorted list.`);
      return list;
    }
  }

  getRuntimeModules() { return this.runtime.getModules(this.getPlugins().filter(p => p.state === 'active')); }
  getAdminMetadata() { 
    return this.admin.getAdminMetadata(
      this.getSortedPlugins(), 
      this.registeredCollections, 
      this.getRuntimeModules()
    ); 
  }

  getImportMap() {
    const modules = this.getRuntimeModules();
    const imports: Record<string, string> = {};
    
    Object.entries(modules).forEach(([name, mod]: [string, any]) => {
       if (mod.url) {
         imports[name] = mod.url;
       } else if (mod.source) {
         imports[name] = `data:text/javascript;base64,${mod.source}`;
       }
    });

    return { imports };
  }

  // Rest of the methods...
  createContext(plugin: LoadedPlugin): PluginContext { return PluginContextFactory.createPluginContext(plugin, this, this.logger); }
  getPlugins(): LoadedPlugin[] { return Array.from(this.plugins.values()); }
  setAuth(auth: any) { this.auth = auth; }
  setApiHost(host: any) { this.apiHost = host; }

  emit(event: string, payload: any) { 
    this.hooks.emit(event, payload);
  }

  async close() {
    const activePlugins = this.getPlugins().filter(plugin => plugin.state === 'active');
    const shutdownOrder = this.getSortedPlugins(activePlugins).reverse();

    for (const plugin of shutdownOrder) {
      try {
        await this.disable(plugin.manifest.slug, { persistState: false });
      } catch (err: any) {
        this.logger.warn(`Failed to disable plugin "${plugin.manifest.slug}" during shutdown: ${err?.message || err}`);
      }
    }
    this.scheduler.stop();
    this.security.stop();
    await this.jobs.close();
  }
}