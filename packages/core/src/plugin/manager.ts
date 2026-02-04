import { FromcodePlugin, LoadedPlugin, PluginContext, PluginManifest, Collection } from '../types';
import { HookManager } from '../hooks/manager';
import { QueueManager } from '../queue/manager';
import { MediaManager, StorageFactory } from '@fromcode/media';
import { SchemaManager } from '../database/schema-manager';
import { EmailManager, EmailFactory } from '@fromcode/email';
import { CacheManager, CacheFactory } from '@fromcode/cache';
import { Logger } from '../logging/logger';
import { I18nManager } from '../i18n/manager';
import { DatabaseManager, sql } from '@fromcode/database';
import { SchedulerService } from '@fromcode/scheduler';
import { loadMigrations } from '../database/migrations';
import { BackupService } from '../management/backup';
import { RegistryPlugin } from '../management/manifest';
import { MigrationCoordinator } from '../management/migration-coordinator';
import { RecordVersions } from '../collections/RecordVersions';
import path from 'path';
import fs from 'fs';
import { createPluginContext, PluginManagerInterface } from './context';

// Services
import { RuntimeService } from './services/RuntimeService';
import { RegistryService } from './services/RegistryService';
import { DiscoveryService } from './services/DiscoveryService';
import { AdminMetadataService } from './services/AdminMetadataService';
import { LifecycleService } from './services/LifecycleService';

export class PluginManager implements PluginManagerInterface {
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
  public auth: any = null;
  public headInjections: Map<string, any[]> = new Map();
  public logger = new Logger({ namespace: 'PluginManager' });
  public registeredCollections: Map<string, { collection: Collection; pluginSlug: string }> = new Map();
  public pluginSettings: Map<string, any> = new Map();
  
  private coordinator: MigrationCoordinator;
  private schemaManager: SchemaManager;
  private projectRoot: string;
  public pluginsRoot: string;

  // Refactored Services
  public runtime: RuntimeService;
  public registry: RegistryService;
  private discovery: DiscoveryService;
  private admin: AdminMetadataService;
  private lifecycle: LifecycleService;

  constructor() {
    this.projectRoot = this.getProjectRoot();
    this.db = new DatabaseManager(process.env.DATABASE_URL || '');
    this.coordinator = new MigrationCoordinator(this.db);
    this.schemaManager = new SchemaManager(this.db);
    this.i18n = new I18nManager(process.env.DEFAULT_LOCALE || 'en');
    this.jobs = new QueueManager({ redisUrl: process.env.REDIS_URL });
    this.scheduler = new SchedulerService(this.db);

    this.pluginsRoot = process.env.PLUGINS_DIR 
      ? path.resolve(process.env.PLUGINS_DIR)
      : path.resolve(this.projectRoot, 'plugins');

    // Initialize Services
    this.runtime = new RuntimeService(this.projectRoot);
    this.registry = new RegistryService(this.db);
    this.discovery = new DiscoveryService(this.pluginsRoot, this.projectRoot);
    this.admin = new AdminMetadataService();
    this.lifecycle = new LifecycleService(this, this.registry, this.discovery, this.schemaManager);

    this.initializeCoreDrivers();
    
    // Start scheduler
    this.scheduler.start();
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
    await this.runSystemMigrations();
    await this.coordinator.validateDatabaseState();
    
    // Register system collections
    this.registeredCollections.set('versions', { collection: RecordVersions, pluginSlug: 'system' });
    
    for (const entry of Array.from(this.registeredCollections.values())) {
      if (entry.pluginSlug === 'system') await this.schemaManager.syncCollection(entry.collection);
    }
  }

  async discoverPlugins() {
    const { discovered, errored } = this.discovery.discoverPlugins(this.plugins);

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

  async updatePlugin(slug: string, pkg: RegistryPlugin): Promise<void> {
    const existing = this.plugins.get(slug);
    if (existing && existing.path) await BackupService.create(slug, existing.path, 'plugins');

    const tempDir = path.join(this.pluginsRoot, `.tmp-update-${slug}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      if (existing?.state === 'active') await this.disable(slug);
      const targetDir = existing?.path || path.join(this.pluginsRoot, slug);
      
      await BackupService.downloadAndExtract(pkg.downloadUrl, tempDir);
      const contentDir = this.discovery.findManifestDir(tempDir);
      if (!contentDir) throw new Error('manifest.json not found');

      if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
      fs.mkdirSync(targetDir, { recursive: true });
      this.discovery.moveDir(contentDir, targetDir);

      this.plugins.delete(slug);
      await this.discoverPlugins();
    } finally {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    }
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

  getRuntimeModules() { return this.runtime.getModules(this.getPlugins().filter(p => p.state === 'active')); }
  getAdminMetadata() { return this.admin.getAdminMetadata(this.plugins, this.registeredCollections, this.getRuntimeModules()); }

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
  emit(event: string, payload: any) { this.hooks.emit(event, payload); }

  private async runSystemMigrations() {
    // Basic table check
    await this.db.execute(sql`CREATE TABLE IF NOT EXISTS _system_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT, "group" TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    
    const row = await this.db.findOne('_system_meta', { key: 'platform_migration_version' });
    const currentVersion = parseInt(row?.value || '0');
    const sortedMigrations = loadMigrations().sort((a, b) => a.version - b.version);

    for (const migration of sortedMigrations) {
      if (migration.version > currentVersion) {
        await migration.up(this.db, sql);
        await this.db.update('_system_meta', { key: 'platform_migration_version' }, { value: migration.version.toString() });
      }
    }
  }

  async close() {
    for (const [slug, plugin] of this.plugins.entries()) {
      if (plugin.state === 'active') await this.disable(slug);
    }
    this.scheduler.stop();
    await this.jobs.close();
  }
}
