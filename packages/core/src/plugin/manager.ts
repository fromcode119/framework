import { FromcodePlugin, LoadedPlugin, PluginContext, PluginManifest, Collection } from '../types';
import { HookManager } from '../hooks/manager';
import { QueueManager } from '../queue/manager';
import { MediaManager, StorageFactory } from '@fromcode/media';
import { SchemaManager } from '../database/schema-manager';
import { MigrationManager } from '../database/MigrationManager';
import { EmailManager, EmailFactory } from '@fromcode/email';
import { CacheManager, CacheFactory } from '@fromcode/cache';
import { Logger } from '../logging/logger';
import { I18nManager } from '../i18n/manager';
import { DatabaseManager, sql } from '@fromcode/database';
import { SchedulerService } from '@fromcode/scheduler';
import { BackupService } from '../management/backup';
import { MigrationCoordinator } from '../management/migration-coordinator';
import { RecordVersions } from '../collections/RecordVersions';
import { AuditManager } from '../security/AuditManager';
import { SecurityMonitor } from '../security/SecurityMonitor';
import { MarketplaceCatalogService } from '../marketplace/MarketplaceCatalogService';
import path from 'path';
import fs from 'fs';
import { createPluginContext, PluginManagerInterface } from './context';

// Services
import { RuntimeService } from './services/RuntimeService';
import { PluginStateService } from './services/PluginStateService';
import { DiscoveryService } from './services/DiscoveryService';
import { AdminMetadataService } from './services/AdminMetadataService';
import { LifecycleService } from './services/LifecycleService';
import { MiddlewareManager } from './services/MiddlewareManager';
import { WorkflowService } from './services/WorkflowService';
import { WebhookService } from '../webhook/WebhookService';
import { WebhooksCollection } from '../collections/Webhooks';
import { registry } from '@fromcode/plugins';

export class PluginManager implements PluginManagerInterface {
  public audit: AuditManager;
  public security: SecurityMonitor;
  public marketplace: MarketplaceCatalogService;
  public plugins: Map<string, LoadedPlugin> = new Map();
  public apiHost: any = null;
  public hooks: HookManager = new HookManager();
  public db: DatabaseManager;
  public storage!: MediaManager;
  public email!: EmailManager;
  public cache!: CacheManager;
  public jobs!: QueueManager;
  public scheduler!: SchedulerService;
  public i18n!: I18nManager;
  public middlewares: MiddlewareManager = new MiddlewareManager();
  public auth: any = null;
  public headInjections: Map<string, any[]> = new Map();
  public logger = new Logger({ namespace: 'PluginManager' });
  public registeredCollections: Map<string, { collection: Collection; pluginSlug: string }> = new Map();
  public pluginSettings: Map<string, any> = new Map();
  
  private coordinator: MigrationCoordinator;
  private schemaManager: SchemaManager;
  private migrationManager: MigrationManager;
  private projectRoot: string;
  public pluginsRoot: string;

  // Refactored Services
  public runtime: RuntimeService;
  public registry: PluginStateService;
  private discovery: DiscoveryService;
  private admin: AdminMetadataService;
  private lifecycle: LifecycleService;
  private workflow: WorkflowService;
  private webhooks: WebhookService;

  constructor() {
    this.projectRoot = this.getProjectRoot();
    this.db = new DatabaseManager(process.env.DATABASE_URL || '');
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

    // Initialize Global Plugin Registry for cohesion
    registry.setDatabase(this.db);

    this.pluginsRoot = process.env.PLUGINS_DIR 
      ? path.resolve(process.env.PLUGINS_DIR)
      : path.resolve(this.projectRoot, 'plugins');

    // Initialize Services
    this.runtime = new RuntimeService(this.projectRoot);
    this.registry = new PluginStateService(this.db);
    this.discovery = new DiscoveryService(this.pluginsRoot, this.projectRoot);
    this.marketplace = new MarketplaceCatalogService(this.discovery);
    this.admin = new AdminMetadataService();
    this.lifecycle = new LifecycleService(this, this.registry, this.discovery, this.schemaManager);

    this.initializeCoreDrivers();
  }

  private initializeCoreDrivers() {
    // Storage
    const storageMode = process.env.STORAGE_DRIVER || 'local';
    const storageConfig = storageMode === 'local' 
      ? { uploadDir: process.env.STORAGE_UPLOAD_DIR || path.resolve(this.projectRoot, 'public/uploads'), publicUrlBase: process.env.STORAGE_PUBLIC_URL || '/uploads' }
      : { region: process.env.STORAGE_S3_REGION || 'auto', bucket: process.env.STORAGE_S3_BUCKET || '', endpoint: process.env.STORAGE_S3_ENDPOINT, credentials: { accessKeyId: process.env.STORAGE_S3_KEY || '', secretAccessKey: process.env.STORAGE_S3_SECRET || '' }, publicUrlBase: process.env.STORAGE_PUBLIC_URL };
    this.storage = new MediaManager(StorageFactory.create(storageMode, storageConfig as any));

    // Email
    const emailMode = process.env.SMTP_HOST ? 'smtp' : 'mock';
    const emailConfig = emailMode === 'smtp' ? { host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587, auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' } } : {};
    this.email = new EmailManager(EmailFactory.create(emailMode, emailConfig));

    // Cache
    const cacheMode = process.env.REDIS_URL ? 'redis' : 'memory';
    const cacheConfig = cacheMode === 'redis' ? { url: process.env.REDIS_URL } : {};
    this.cache = new CacheManager(CacheFactory.create(cacheMode, cacheConfig));
  }

  private getProjectRoot(): string {
    let current = process.cwd();
    while (current !== path.parse(current).root) {
      if (fs.existsSync(path.join(current, 'package.json'))) {
        try {
          if (JSON.parse(fs.readFileSync(path.join(current, 'package.json'), 'utf8')).name === '@fromcode/framework') return current;
        } catch {}
      }
      current = path.dirname(current);
    }
    return process.cwd();
  }

  async init() {
    await this.migrationManager.migrate();
    await this.coordinator.validateDatabaseState();
    
    // Register background workers - MUST happen after migrations but before scheduler starts
    this.jobs.registerWorker('scheduler', async (job) => {
      const { taskName } = job.data;
      await this.scheduler.runHandler(taskName);
    });

    // Register global content workflow task - MUST happen after migrations
    await this.scheduler.register('content-workflows', '2m', async () => {
      await this.workflow.processScheduledContent(this.getCollections());
    });
    
    // Register system collections
    this.registeredCollections.set('versions', { collection: RecordVersions, pluginSlug: 'system' });
    this.registeredCollections.set('webhooks', { collection: WebhooksCollection, pluginSlug: 'system' });
    
    for (const entry of Array.from(this.registeredCollections.values())) {
      if (entry.pluginSlug === 'system') await this.schemaManager.syncCollection(entry.collection);
    }

    await this.webhooks.initialize();

    // Start background services after migrations and system collections are ready
    await this.scheduler.start();
    this.security.start();
  }

  async discoverPlugins() {
    const { discovered, errored } = await this.discovery.discoverPlugins(this.plugins);

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

  // Delegate Lifecycle
  async enable(slug: string) { return this.lifecycle.enable(slug); }
  async disable(slug: string) { return this.lifecycle.disable(slug); }
  async delete(slug: string) { return this.lifecycle.delete(slug); }
  async register(plugin: FromcodePlugin, path?: string) { return this.lifecycle.register(plugin, path); }

  async writeLog(level: string, message: string, pluginSlug?: string, context?: any) {
    return this.registry.writeLog(level, message, pluginSlug, context);
  }

  async savePluginConfig(slug: string, config: any) {
    await this.registry.savePluginConfig(slug, config);
    const plugin = this.plugins.get(slug);
    if (plugin) {
      plugin.manifest.config = config;
    }
  }

  async saveSandboxConfig(slug: string, config: any) {
    const { systemPlugins, eq } = require('@fromcode/database');
    await (this.db as any).update(systemPlugins, { slug }, { 
      sandboxConfig: config 
    });
    
    const plugin = this.plugins.get(slug);
    if (plugin) {
      // Merge into the manifest representation
      if (!plugin.manifest.sandbox || typeof plugin.manifest.sandbox === 'boolean') {
        plugin.manifest.sandbox = config;
      } else {
        plugin.manifest.sandbox = { ...plugin.manifest.sandbox, ...config };
      }
    }
    
    this.logger.info(`Sandbox configuration updated for plugin: ${slug}`);
  }

  public getHeadInjections(slug: string): any[] {
    return this.headInjections.get(slug) || [];
  }

  getCollections() {
    return Array.from(this.registeredCollections.values()).map(c => c.collection);
  }

  getCollection(slug: string) {
    return this.registeredCollections.get(slug);
  }

  public registerPluginSettings(pluginSlug: string, schema: any): void {
    this.pluginSettings.set(pluginSlug, schema);
    this.logger.info(`Settings registered for plugin: ${pluginSlug}`);
  }

  public getPluginSettings(pluginSlug: string): any | undefined {
    return this.pluginSettings.get(pluginSlug);
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
      await this.db.update('_system_plugins', { slug }, { state: 'error', health_status: 'error', updated_at: new Date() });
    }
  }

  public async getSecuritySummary() {
    return {
      sandbox: await this.lifecycle.getSandboxStats(),
      monitor: await this.security.getSecurityStats(),
      integrityEnforced: true,
      signatureEnforced: !!process.env.REQUIRE_SIGNATURES
    };
  }

  /**
   * Returns plugins in topological order based on their dependencies.
   * If a list of plugins is provided, it sorts that list; otherwise, it sorts all known plugins.
   */
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
  createContext(plugin: LoadedPlugin): PluginContext { return createPluginContext(plugin, this, this.logger); }
  getPlugins(): LoadedPlugin[] { return Array.from(this.plugins.values()); }
  setAuth(auth: any) { this.auth = auth; }
  setApiHost(host: any) { this.apiHost = host; }

  emit(event: string, payload: any) { 
    this.hooks.emit(event, payload); 
    this.webhooks.processEvent(event, payload).catch(err => this.logger.error(`Webhook delivery failed for ${event}:`, err));
  }

  async close() {
    for (const [slug, plugin] of this.plugins.entries()) {
      if (plugin.state === 'active') await this.disable(slug);
    }
    this.scheduler.stop();
    this.security.stop();
    await this.jobs.close();
  }
}
