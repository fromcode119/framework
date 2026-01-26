import { FromcodePlugin, LoadedPlugin, PluginContext, PluginManifest, Collection, TranslationMap } from '../types';
import { v4 as uuidv4 } from 'uuid';
import semver from 'semver';
import { HookManager } from '../hooks/manager';
import { MediaManager, LocalStorageDriver } from '@fromcode/media';
import { SchemaManager } from '../database/schema-manager';
import { EmailManager, MockEmailDriver, SMTPDriver } from '@fromcode/email';
import { CacheManager, MemoryCacheDriver, RedisCacheDriver } from '@fromcode/cache';
import { Logger } from '../logging/logger';
import { I18nManager } from '../i18n/manager';
import { DatabaseManager, IDatabaseManager, systemPlugins, systemPluginSettings, systemMeta, systemLogs, infoTables, sql, eq, and, count, desc, trustedPublishers } from '@fromcode/database';
import { loadMigrations } from '../database/migrations';
import { PluginPermissionsService } from '../security/permissions';
import { PluginSignatureService } from '../security/signature';
import { PluginBackupService } from '../management/backup';
import { validatePluginManifest, RegistryPlugin } from '../management/manifest';
import { MigrationCoordinator } from '../management/migration-coordinator';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { createPluginContext, PluginManagerInterface } from './context';

export class PluginManager implements PluginManagerInterface {
  public plugins: Map<string, LoadedPlugin> = new Map();
  public apiHost: any = null;
  public hooks: HookManager = new HookManager();
  public db: DatabaseManager;
  private coordinator: MigrationCoordinator;
  private schemaManager: SchemaManager;
  public storage: MediaManager;
  public email!: EmailManager;
  public cache!: CacheManager;
  public i18n: I18nManager;
  public auth: any = null;
  public headInjections: Map<string, any[]> = new Map();
  public logger = new Logger({ namespace: 'PluginManager' });
  public registeredCollections: Map<string, { collection: Collection; pluginSlug: string }> = new Map();
  public pluginsRoot: string;

  constructor() {
    this.db = new DatabaseManager(process.env.DATABASE_URL || '');
    this.coordinator = new MigrationCoordinator(this.db);
    this.schemaManager = new SchemaManager(this.db);
    this.i18n = new I18nManager(process.env.DEFAULT_LOCALE || 'en');
    
    // Prioritize a dedicated plugins directory in the workspace root
    this.pluginsRoot = process.env.PLUGINS_DIR 
      ? path.resolve(process.env.PLUGINS_DIR)
      : (fs.existsSync(path.resolve(process.cwd(), 'plugins'))
          ? path.resolve(process.cwd(), 'plugins')
          : path.resolve(process.cwd(), '../../plugins'));

    const uploadDir = process.env.STORAGE_UPLOAD_DIR || path.resolve(process.cwd(), 'public/uploads');
    this.storage = new MediaManager(new LocalStorageDriver(uploadDir, process.env.STORAGE_PUBLIC_URL || '/uploads'));

    // Initialize Email
    if (process.env.SMTP_HOST) {
      this.email = new EmailManager(new SMTPDriver({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        }
      }));
    } else {
      this.email = new EmailManager(new MockEmailDriver());
    }

    // Initialize Cache
    if (process.env.REDIS_URL) {
      this.cache = new CacheManager(new RedisCacheDriver(process.env.REDIS_URL));
    } else {
      this.cache = new CacheManager(new MemoryCacheDriver());
    }
  }

  async init() {
    await this.runSystemMigrations();
    await this.coordinator.validateDatabaseState();
  }

  async discoverPlugins() {
    this.logger.info(`Scanning for plugins in ${this.pluginsRoot}...`);
    if (!fs.existsSync(this.pluginsRoot)) {
        this.logger.warn(`Plugins directory ${this.pluginsRoot} does not exist.`);
        return [];
    }

    const pluginDirs = fs.readdirSync(this.pluginsRoot);
    this.logger.info(`Found ${pluginDirs.length} entries in plugins directory.`);
    const discovered: any[] = [];

    for (const dir of pluginDirs) {
      if (dir.startsWith('.')) continue; // Skip .DS_Store etc

      const pluginPath = path.join(this.pluginsRoot, dir);
      if (!fs.statSync(pluginPath).isDirectory()) continue;

      const manifestPath = path.join(pluginPath, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifestContent = fs.readFileSync(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestContent);
          this.logger.info(`Found manifest for "${manifest.slug}" v${manifest.version}`);

          const indexPath = path.join(pluginPath, manifest.main || 'index.js');
          
          if (fs.existsSync(indexPath)) {
            // Delete from require cache to allow reloading
            try {
                const resolved = require.resolve(indexPath);
                if (require.cache[resolved]) {
                    this.logger.debug(`Clearing require cache for ${manifest.slug}`);
                    delete require.cache[resolved];
                }
            } catch (e) {}

            const pluginModule = require(indexPath);
            discovered.push({
              plugin: {
                manifest,
                ...pluginModule
              },
              path: pluginPath
            });
          } else {
              this.logger.warn(`Missing entry point for "${manifest.slug}" at ${indexPath}`);
          }
        } catch (err: any) {
          this.logger.warn(`Failed to stage plugin from ${dir}: ${err.message}`);
        }
      } else {
          this.logger.debug(`No manifest.json found in ${pluginPath}`);
      }
    }

    // Resolve dependencies and register in order
    try {
      const sorted = this.resolveDependencies(discovered.map(d => d.plugin));
      
      // Coordinate migrations and check for conflicts
      await this.coordinator.coordinate(sorted.map(p => p.manifest));
      
      this.logger.info(`Topologically sorted ${sorted.length} plugins for registration.`);

      for (const plugin of sorted) {
        // Skip if already registered and version is same (unless we want to force reload)
        const existing = this.plugins.get(plugin.manifest.slug);
        if (existing && existing.manifest.version === plugin.manifest.version) {
           this.logger.debug(`Plugin "${plugin.manifest.slug}" v${plugin.manifest.version} already registered.`);
           continue; 
        }

        const stage = discovered.find(d => d.plugin.manifest.slug === plugin.manifest.slug);
        await this.register(plugin, stage.path);
        this.logger.info(`Registered plugin: ${plugin.manifest.slug} (v${plugin.manifest.version}) status=${this.plugins.get(plugin.manifest.slug)?.state}`);
      }
    } catch (err: any) {
      this.logger.error(`Plugin discovery/registration failed: ${err.message}`);
    }
  }

  async getPluginConfig(slug: string): Promise<any> {
    try {
      const [row]: any = await this.db.drizzle
        .select({ settings: systemPluginSettings.settings })
        .from(systemPluginSettings)
        .where(eq(systemPluginSettings.pluginSlug, slug))
        .limit(1);
      return row?.settings || {};
    } catch (err) {
      return {};
    }
  }

  async savePluginConfig(slug: string, config: any): Promise<void> {
    try {
      await this.db.drizzle
        .insert(systemPluginSettings)
        .values({
          pluginSlug: slug,
          settings: config,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: systemPluginSettings.pluginSlug,
          set: {
            settings: config,
            updatedAt: new Date()
          }
        });
      
      // Update memory state if plugin is loaded
      const plugin = this.plugins.get(slug);
      if (plugin) {
        plugin.manifest.config = config;
        this.emit(`plugin:${slug}:config_updated`, config);
      }
    } catch (err) {
      this.logger.error(`Failed to save config for plugin ${slug}`, err);
      throw err;
    }
  }

  private async runSystemMigrations() {
    this.logger.info('Checking for system migrations...');
    
    // 0. Ensure meta table exists to track versions
    try {
      await this.db.drizzle.execute(sql`
        CREATE TABLE IF NOT EXISTS _system_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch (err) {
      this.logger.error('Failed to create system meta table', err);
      return;
    }

    const getVersion = async () => {
      try {
        const [row]: any = await this.db.drizzle
          .select({ value: systemMeta.value })
          .from(systemMeta)
          .where(eq(systemMeta.key, 'platform_migration_version'))
          .limit(1);
        return parseInt(row?.value || '0');
      } catch (e) { return 0; }
    };

    const setVersion = async (v: number) => {
      await this.db.drizzle.insert(systemMeta)
        .values({
          key: 'platform_migration_version',
          value: v.toString(),
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: systemMeta.key,
          set: {
            value: v.toString(),
            updatedAt: new Date()
          }
        });
    };

    const currentVersion = await getVersion();
    // Auto-detect and sort migrations by version to ensure correct order
    const sortedMigrations = loadMigrations().sort((a, b) => a.version - b.version);

    for (const migration of sortedMigrations) {
      if (migration.version > currentVersion) {
        this.logger.info(`Running system migration ${migration.version}: ${migration.name}`);
        try {
          await migration.up(this.db, sql);
          await setVersion(migration.version);
        } catch (err) {
          this.logger.error(`Migration ${migration.version} failed`, err);
          throw err; // Stop if core migration fails
        }
      }
    }
  }

  setAuth(auth: any) {
    this.auth = auth;
  }

  emit(event: string, payload: any) {
    this.hooks.emit(event, payload);
  }

  async writeLog(level: string, message: string, pluginSlug?: string, context?: any) {
    try {
      await this.db.drizzle.insert(systemLogs).values({
        level,
        message,
        pluginSlug,
        context: context ? JSON.stringify(context) : null,
        timestamp: new Date()
      });
    } catch (err) {
      this.logger.error('Failed to write log to DB', err);
    }
  }

  setApiHost(host: any) {
    this.apiHost = host;
  }

  public getHeadInjections(slug: string): any[] {
    return this.headInjections.get(slug) || [];
  }

  private async loadRegistry(): Promise<Record<string, { state: string; approvedCapabilities: string[] }>> {
    try {
      const result = await this.db.drizzle
        .select({ 
          slug: systemPlugins.slug, 
          state: systemPlugins.state,
          capabilities: systemPlugins.capabilities 
        })
        .from(systemPlugins);

      const registry: Record<string, { state: string; approvedCapabilities: string[] }> = {};
      result.forEach((row) => {
        registry[row.slug] = { 
          state: row.state,
          approvedCapabilities: row.capabilities ? JSON.parse(row.capabilities) : []
        };
      });
      return registry;
    } catch (err) {
      this.logger.error('Failed to load plugin registry from DB', err);
      return {};
    }
  }

  private async saveRegistryItem(slug: string, state: string, capabilities?: string[], version?: string) {
    try {
      const values: any = { slug, state, updatedAt: new Date() };
      if (capabilities) {
        values.capabilities = JSON.stringify(capabilities);
      }
      if (version) {
        values.version = version;
      }

      await this.db.drizzle
        .insert(systemPlugins)
        .values(values)
        .onConflictDoUpdate({
          target: systemPlugins.slug,
          set: values
        });
    } catch (err) {
      this.logger.error(`Failed to save plugin state for ${slug} to DB`, err);
    }
  }

  /**
   * Validates that all dependencies for a plugin are satisfied and sorts them topologically
   */
  private resolveDependencies(plugins: FromcodePlugin[]): FromcodePlugin[] {
    const adj: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();
    const pluginMap: Map<string, FromcodePlugin> = new Map();

    // Initialize
    plugins.forEach(p => {
      pluginMap.set(p.manifest.slug, p);
      if (!adj.has(p.manifest.slug)) adj.set(p.manifest.slug, []);
      if (!inDegree.has(p.manifest.slug)) inDegree.set(p.manifest.slug, 0);
    });

    // Build Graph
    plugins.forEach(p => {
      if (p.manifest.dependencies) {
        Object.keys(p.manifest.dependencies).forEach(depSlug => {
          if (pluginMap.has(depSlug)) {
            // DepSlug -> P.slug (DepSlug must load before P.slug)
            adj.get(depSlug)!.push(p.manifest.slug);
            inDegree.set(p.manifest.slug, (inDegree.get(p.manifest.slug) || 0) + 1);
          }
        });
      }
    });

    // Kahn's Algorithm
    const queue: string[] = [];
    inDegree.forEach((degree, slug) => {
      if (degree === 0) queue.push(slug);
    });

    const result: FromcodePlugin[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      result.push(pluginMap.get(u)!);

      adj.get(u)?.forEach(v => {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) queue.push(v);
      });
    }

    if (result.length !== plugins.length) {
      const cycleNodes = Array.from(inDegree.keys()).filter(slug => inDegree.get(slug)! > 0);
      throw new Error(`Circular dependency detected involving plugins: ${cycleNodes.join(', ')}`);
    }

    return result;
  }

  async register(plugin: FromcodePlugin, pluginPath?: string): Promise<void> {
    const slug = plugin.manifest.slug;
    if (this.plugins.has(slug)) {
      throw new Error(`Plugin with slug "${slug}" is already registered.`);
    }

    // 1. Validate Manifest Schema
    try {
      validatePluginManifest(plugin.manifest);
    } catch (err) {
      this.logger.error(`Plugin "${slug}" has an invalid manifest: ${err}`);
      throw new Error(`Invalid manifest for "${slug}"`);
    }

    // 2. Signature verification in production
    if (PluginSignatureService.isEnforced()) {
      let publicKey = '';
      
      // Try to find publisher public key
      const publisherId = (plugin.manifest as any).publisherId;
      if (publisherId) {
        try {
          const [publisher]: any = await this.db.drizzle
            .select({ publicKey: trustedPublishers.publicKey })
            .from(trustedPublishers)
            .where(and(eq(trustedPublishers.publisherId, publisherId), eq(trustedPublishers.isActive, true)))
            .limit(1);
          publicKey = publisher?.publicKey || '';
        } catch (e) {}
      }

      const isValid = PluginSignatureService.verify(plugin.manifest, plugin.manifest.signature || '', publicKey);
      if (!isValid) {
        this.logger.error(`Plugin "${slug}" has an invalid or missing cryptographic signature.`);
        throw new Error(`Security Violation: Invalid signature for plugin "${slug}"`);
      }
    }

    // 3. Dependency Check
    this.validateDependencies(plugin.manifest);

    const registry = await this.loadRegistry();
    const saved = registry[slug];
    let state = saved?.state || 'inactive';

    // 4. Security Check: Detect capability drift
    if (state === 'active') {
      const currentCaps = [...(plugin.manifest.capabilities || [])].sort().join(',');
      const approvedCaps = [...(saved?.approvedCapabilities || [])].sort().join(',');

      if (currentCaps !== approvedCaps) {
        this.logger.warn(`Capability Drift detected for "${slug}". New capabilities require re-approval.`);
        state = 'inactive';
        await this.saveRegistryItem(slug, 'inactive', undefined, plugin.manifest.version); 
      }
    }

    const loadedPlugin: LoadedPlugin = {
      ...plugin,
      instanceId: uuidv4(),
      state: 'inactive', // Initial state for loaded plugin
      path: pluginPath,
      approvedCapabilities: saved?.approvedCapabilities || []
    };

    // Load persisted config
    loadedPlugin.manifest.config = await this.getPluginConfig(slug);

    this.plugins.set(slug, loadedPlugin);
    
    await this.writeLog('INFO', `Plugin "${slug}" (v${plugin.manifest.version}) registered in system registry. Status: ${state}`, slug);

    // Update DB health and version, but DON'T overwrite approved capabilities if we are already registered
    // until the user explicitly enables/approves the plugin.
    await this.saveRegistryItem(slug, state, saved ? undefined : (plugin.manifest.capabilities as string[]), plugin.manifest.version);

    // Auto-enable if saved state was active and no drift
    if (state === 'active') {
      await this.enable(slug);
    }
  }

  /**
   * Validates that all dependencies for a plugin are satisfied
   */
  private validateDependencies(manifest: PluginManifest): void {
    if (!manifest.dependencies) return;

    for (const [depSlug, versionRange] of Object.entries(manifest.dependencies)) {
      const dependency = this.plugins.get(depSlug);
      
      if (!dependency) {
        throw new Error(`Missing dependency: Plugin "${manifest.slug}" requires "${depSlug}" (${versionRange})`);
      }

      if (!semver.satisfies(dependency.manifest.version, versionRange)) {
        throw new Error(`Incompatible dependency: Plugin "${manifest.slug}" requires "${depSlug}" version "${versionRange}", but version "${dependency.manifest.version}" is installed.`);
      }
    }
  }

  /**
   * Installs or Updates a plugin from the marketplace
   */
  async updatePlugin(slug: string, pkg: RegistryPlugin): Promise<void> {
    const existing = this.plugins.get(slug);
    
    this.logger.info(`Building "${slug}" v${pkg.version}...`);
    
    // 1. Check Semver (Don't downgrade unless forced)
    if (existing && semver.lt(pkg.version, existing.manifest.version)) {
      this.logger.warn(`Version ${pkg.version} is older than currently installed ${existing.manifest.version}`);
    }

    // 2. Create Backup before destructive operations (only if it exists)
    let backupPath = '';
    if (existing && existing.path) {
      try {
        backupPath = await PluginBackupService.createBackup(slug, existing.path);
        this.logger.info(`Created backup at ${backupPath}`);
        
        // Update registry with backup path
        await this.db.drizzle.update(systemPlugins)
          .set({ backupPath, updatedAt: new Date() })
          .where(eq(systemPlugins.slug, slug));

      } catch (err) {
        this.logger.error(`Failed to create backup: ${err}`);
        throw new Error(`Update aborted: Could not create backup.`);
      }
    }

    const tempDir = path.join(this.pluginsRoot, `.tmp-update-${slug}-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // 3. Disable existing
      if (existing && existing.state === 'active') {
        await this.disable(slug);
      }

      // 4. Download and extract to temporary staged area
      const targetDir = existing && existing.path 
        ? existing.path
        : path.join(this.pluginsRoot, slug);
      
      this.logger.info(`Downloading "${slug}" from ${pkg.downloadUrl}...`);
      await PluginBackupService.downloadAndExtractPlugin(pkg.downloadUrl, tempDir);
      
      // 5. Flatten structure: find where manifest.json actually is
      const contentDir = this.findManifestDir(tempDir);
      if (!contentDir) {
        throw new Error('Invalid plugin package: manifest.json not found.');
      }

      // 6. Replace target directory with new content
      if (fs.existsSync(targetDir)) {
          this.logger.info(`Cleaning target directory ${targetDir} for clean update`);
          fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.mkdirSync(targetDir, { recursive: true });
      
      this.moveDir(contentDir, targetDir);
      this.logger.info(`Files for "${slug}" v${pkg.version} ${existing ? 'updated' : 'staged'} at ${targetDir}.`);

      // 7. Update DB and mark as inactive. 
      // CRITICAL: We DO NOT update 'capabilities' here. 
      // This ensures that register() and the UI can detect the "Drift" between 
      // manifest capabilities (staged on disk) and approved capabilities (in DB).
      await this.saveRegistryItem(slug, 'inactive', undefined, pkg.version);

      if (existing) {
          await this.db.drizzle.update(systemPlugins)
            .set({ 
              hasUpdate: false,
              healthStatus: 'healthy',
              updatedAt: new Date() 
            })
            .where(eq(systemPlugins.slug, slug));
      }

      // 8. Reload plugins to pick up the new one immediately
      this.plugins.delete(slug); // Force re-registration during discovery
      await this.discoverPlugins();

      this.logger.info(`Plugin "${slug}" ${existing ? 'updated' : 'installed'} successfully and registered.`);
      
    } catch (err) {
      this.logger.error(`${existing ? 'Update' : 'Installation'} failed: ${err}`);
      throw err;
    } finally {
      // Cleanup temp
      try {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }

  private findManifestDir(dir: string): string | null {
    if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        const found = this.findManifestDir(fullPath);
        if (found) return found;
      }
    }
    return null;
  }

  async enable(slug: string): Promise<void> {
    const plugin = this.plugins.get(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found.`);
    if (plugin.state === 'active') return;

    const ctx = this.createContext(plugin);
    
    try {
      plugin.state = 'loading';
      if (plugin.onInit) {
        await plugin.onInit(ctx);
        if ((plugin.state as string) === 'error') throw new Error(`Plugin "${slug}" failed during onInit (Security Violation or Error)`);
      }
      
      if (plugin.onEnable) {
        await plugin.onEnable(ctx);
        if ((plugin.state as string) === 'error') throw new Error(`Plugin "${slug}" failed during onEnable (Security Violation or Error)`);
      }
      
      // Auto-sync collections registered by this plugin
      await this.syncPluginCollections(slug);
      if ((plugin.state as string) === 'error') throw new Error(`Plugin "${slug}" failed during collection sync (Security Violation or Error)`);

      plugin.state = 'active';
      // Store and update approved capabilities when enabling
      const currentCaps = plugin.manifest.capabilities as string[] || [];
      plugin.approvedCapabilities = currentCaps;
      
      await this.saveRegistryItem(slug, 'active', currentCaps, plugin.manifest.version);
      
      this.logger.info(`Plugin "${slug}" enabled and capabilities approved.`);
      await this.writeLog('INFO', `Plugin "${slug}" successfully enabled and initialized. Capabilities approved: ${currentCaps.join(', ') || 'none'}`, slug);
    } catch (error) {
      plugin.state = 'error';
      this.logger.error(`Failed to enable plugin "${slug}": ${error}`);
      await this.writeLog('ERROR', `Initialization failed for "${slug}": ${error}`, slug);

      await this.db.drizzle.update(systemPlugins)
        .set({ healthStatus: 'error', updatedAt: new Date() })
        .where(eq(systemPlugins.slug, slug));

      throw error;
    }
  }

  async disable(slug: string): Promise<void> {
    const plugin = this.plugins.get(slug);
    if (!plugin || plugin.state !== 'active') return;

    const ctx = this.createContext(plugin);
    try {
      if (plugin.onDisable) await plugin.onDisable(ctx);
      plugin.state = 'inactive';
      await this.saveRegistryItem(slug, 'inactive', undefined, plugin.manifest.version);
      this.logger.info(`Plugin "${slug}" disabled.`);
      await this.writeLog('INFO', `Plugin "${slug}" disabled by administrator.`, slug);
    } catch (error) {
      this.logger.error(`Error disabling plugin "${slug}": ${error}`);
      await this.writeLog('ERROR', `Error during disable sequence for "${slug}": ${error}`, slug);
    }
  }

  async disableWithError(slug: string, message: string): Promise<void> {
    const plugin = this.plugins.get(slug);
    if (!plugin) return;

    plugin.state = 'error';
    await this.db.drizzle.update(systemPlugins)
      .set({ state: 'error', healthStatus: 'error', updatedAt: new Date() })
      .where(eq(systemPlugins.slug, slug));
      
    this.logger.error(`Plugin "${slug}" moved to error state: ${message}`);
  }

  async delete(slug: string): Promise<void> {
    const plugin = this.plugins.get(slug);
    
    // 1. Check for dependents (only if loaded)
    if (plugin) {
      const dependents = Array.from(this.plugins.values()).filter(p => 
        p.manifest.dependencies && p.manifest.dependencies[slug]
      );

      if (dependents.length > 0) {
        throw new Error(`Cannot delete plugin "${slug}" because it is required by: ${dependents.map(p => p.manifest.slug).join(', ')}`);
      }

      // 2. Disable if active
      if (plugin.state === 'active') {
        await this.disable(slug);
      }
    }

    // 2. Remove from registry table
    try {
      await this.db.drizzle
        .delete(systemPlugins)
        .where(eq(systemPlugins.slug, slug));
    } catch (err) {
      this.logger.error(`Failed to remove plugin "${slug}" from DB registry`, err);
    }

    // 3. Remove from memory
    const pluginPath = plugin?.path;
    this.plugins.delete(slug);

    // 4. Cleanup registered collections linked to this plugin
    for (const [colSlug, entry] of this.registeredCollections.entries()) {
      if (entry.pluginSlug === slug) {
        this.registeredCollections.delete(colSlug);
      }
    }

    // 5. Cleanup files from disk (Optional/Destructive)
    try {
        const targetPath = pluginPath || path.resolve(this.pluginsRoot, slug);
        if (targetPath && fs.existsSync(targetPath)) {
            this.logger.info(`Cleaning up files for "${slug}" at ${targetPath}`);
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
    } catch (e) {
        this.logger.error(`Disk cleanup failed for "${slug}": ${e}`);
    }

    this.logger.info(`Plugin "${slug}" deleted from system.`);
  }

  private createContext(plugin: LoadedPlugin): PluginContext {
    return createPluginContext(plugin, this, this.logger);
  }

  private async syncPluginCollections(pluginSlug: string) {
    const pluginCollections = Array.from(this.registeredCollections.values())
      .filter(entry => entry.pluginSlug === pluginSlug);

    if (pluginCollections.length === 0) return;

    this.logger.info(`Starting atomic sync for plugin "${pluginSlug}"...`);

    try {
      // Coordinated sync within a single transaction if supported by driver
      // For now we rely on the individual transactions in SchemaManager per collection
      for (const { collection } of pluginCollections) {
        await this.schemaManager.syncCollection(collection);
      }
    } catch (error) {
      this.logger.error(`Atomic sync failed for plugin "${pluginSlug}": ${error}`);
      throw error;
    }
  }

  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Installs a plugin from a compressed file (staged).
   * Supports .zip and .tar.gz
   */
  async installFromZip(filePath: string, pluginsRoot: string): Promise<void> {
    this.logger.info(`Installing plugin from: ${filePath}`);
    
    // We'll create a temporary extraction directory
    const tempDir = path.join(path.dirname(filePath), `ext-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      if (filePath.endsWith('.zip')) {
        const zip = new AdmZip(filePath);
        zip.extractAllTo(tempDir, true);
      } else {
        // Extract the plugin (using our backup service restore logic which handles tar.gz)
        await PluginBackupService.restoreBackup(filePath, tempDir);
      }

      // Look for manifest.json in the extracted folder
      // Improved flattening: find the directory that actually contains manifest.json
      const findManifestDir = (dir: string): string | null => {
        if (fs.existsSync(path.join(dir, 'manifest.json'))) return dir;
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            const found = findManifestDir(fullPath);
            if (found) return found;
          }
        }
        return null;
      };

      const contentDir = findManifestDir(tempDir);
      if (!contentDir) {
        throw new Error('Invalid plugin: manifest.json not found anywhere in the archive.');
      }

      const manifestContent = fs.readFileSync(path.join(contentDir, 'manifest.json'), 'utf8');
      const manifest = JSON.parse(manifestContent);
      const targetDir = path.join(pluginsRoot, manifest.slug);

      // 1. Ensure target directory exists and is clean
      if (fs.existsSync(targetDir)) {
          // If the target is just a folder containing the REAL content (wrapped),
          // or if it's the wrong structure, back it up and clear it.
          await PluginBackupService.createBackup(manifest.slug, targetDir);
          fs.rmSync(targetDir, { recursive: true, force: true });
      }
      fs.mkdirSync(targetDir, { recursive: true });
      
      // 2. Move content directly to targetDir
      this.moveDir(contentDir, targetDir);

      this.logger.info(`Plugin ${manifest.slug} staged successfully at ${targetDir}`);
      
      // Reload discovery
      await this.discoverPlugins();
    } finally {
      // Cleanup temp
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }

  private moveDir(src: string, dest: string) {
    const files = fs.readdirSync(src);
    for (const file of files) {
      const srcFile = path.join(src, file);
      const destFile = path.join(dest, file);
      
      if (fs.statSync(srcFile).isDirectory()) {
        if (!fs.existsSync(destFile)) fs.mkdirSync(destFile, { recursive: true });
        this.moveDir(srcFile, destFile);
      } else {
        // Use copy + unlink if rename fails across partitions (common in Docker)
        try {
          fs.renameSync(srcFile, destFile);
        } catch (e) {
          fs.copyFileSync(srcFile, destFile);
          fs.unlinkSync(srcFile);
        }
      }
    }
  }

  getCollections() {
    return Array.from(this.registeredCollections.values()).map(c => c.collection);
  }

  getCollection(slug: string) {
    return this.registeredCollections.get(slug);
  }

  getAdminMetadata() {
    const allPlugins = Array.from(this.plugins.values());
    
    // Add virtual system plugin for core collections if not present
    const systemCollections = Array.from(this.registeredCollections.values())
      .filter(c => c.pluginSlug === 'system')
      .map(c => c.collection);

    const pluginMetadata = allPlugins
      .filter(p => p.state === 'active' && p.manifest.admin)
      .map(p => {
        const collections = Array.from(this.registeredCollections.values())
          .filter(c => c.pluginSlug === p.manifest.slug)
          .map(c => c.collection);

        return {
          slug: p.manifest.slug,
          name: p.manifest.name,
          admin: {
            ...p.manifest.admin,
            collections
          },
          ui: {
            ...(p.manifest.ui || {}),
            // We explicitly do not include general headInjections in admin metadata
            // to prevent plugins from poisoning the admin panel HTML (Security).
            // Main UI components are loaded via ui.entry and ui.css.
            headInjections: []
          }
        };
      });

    if (systemCollections.length > 0) {
      pluginMetadata.unshift({
        slug: 'system',
        name: 'Platform',
        admin: {
          group: 'Platform',
          icon: 'Shield',
          collections: systemCollections
        } as any,
        ui: {
          headInjections: []
        }
      });
    }

    // Generate Unified Menu
    const menuItems: any[] = [];

    // 1. Process explicit menu items from manifests
    pluginMetadata.forEach(p => {
      if (p.admin?.menu) {
        p.admin.menu.forEach(item => {
          menuItems.push({
            ...item,
            pluginSlug: p.slug,
            group: item.group || p.admin.group || null
          });
        });
      }

      // 2. Automatically generate menu items for collections
      if (p.admin?.collections) {
        p.admin.collections.forEach(col => {
          // Check if there's already a menu item for this path
          const path = `/content/${col.slug}`;
          if (!menuItems.find(m => m.path === path)) {
            menuItems.push({
              label: col.name || col.slug.charAt(0).toUpperCase() + col.slug.slice(1),
              path,
              icon: col.admin?.icon || p.admin.icon || 'FileText',
              group: col.admin?.group || p.admin.group || null,
              pluginSlug: p.slug,
              // Special case for users to add children placeholders if requested
              children: col.slug === 'users' ? [
                { label: 'Roles', path: '/users/roles' },
                { label: 'Permissions', path: '/users/permissions' }
              ] : undefined
            });
          }
        });
      }
    });

    return {
      plugins: pluginMetadata,
      menu: menuItems.sort((a, b) => (a.priority || 0) - (b.priority || 0))
    };
  }
}
