import { FromcodePlugin, LoadedPlugin, PluginContext, PluginManifest, Collection, TranslationMap } from '../types';
import { v4 as uuidv4 } from 'uuid';
import semver from 'semver';
import { HookManager } from '../hooks/manager';
import { QueueManager } from '../queue/manager';
import { MediaManager, StorageFactory } from '@fromcode/media';
import { SchemaManager } from '../database/schema-manager';
import { EmailManager, EmailFactory } from '@fromcode/email';
import { CacheManager, CacheFactory } from '@fromcode/cache';
import { Logger } from '../logging/logger';
import { I18nManager } from '../i18n/manager';
import { DatabaseManager, sql, eq, and, count, desc } from '@fromcode/database';
import { loadMigrations } from '../database/migrations';
import { PluginPermissionsService } from '../security/permissions';
import { PluginSignatureService } from '../security/signature';
import { BackupService } from '../management/backup';
import { validatePluginManifest, RegistryPlugin } from '../management/manifest';
import { MigrationCoordinator } from '../management/migration-coordinator';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { createPluginContext, PluginManagerInterface } from './context';
import { RecordVersions } from '../collections/RecordVersions';

export class PluginManager implements PluginManagerInterface {
  public plugins: Map<string, LoadedPlugin> = new Map();
  public apiHost: any = null;
  public hooks: HookManager = new HookManager();
  public db: DatabaseManager;
  private coordinator: MigrationCoordinator;
  private schemaManager: SchemaManager;
  public storage: MediaManager;
  public email: EmailManager;
  public cache: CacheManager;
  public jobs: QueueManager;
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
    this.jobs = new QueueManager({ redisUrl: process.env.REDIS_URL });
    
    // Use root-aware resolution for directories
    const rootDir = this.getProjectRoot();
    
    this.pluginsRoot = process.env.PLUGINS_DIR 
      ? path.resolve(process.env.PLUGINS_DIR)
      : path.resolve(rootDir, 'plugins');

    // Initialize Storage
    const storageMode = process.env.STORAGE_DRIVER || 'local';
    try {
      const storageConfig = storageMode === 'local' 
        ? { 
            uploadDir: process.env.STORAGE_UPLOAD_DIR || path.resolve(rootDir, 'public/uploads'),
            publicUrlBase: process.env.STORAGE_PUBLIC_URL || '/uploads'
          }
        : {
            region: process.env.STORAGE_S3_REGION || 'auto',
            bucket: process.env.STORAGE_S3_BUCKET || '',
            endpoint: process.env.STORAGE_S3_ENDPOINT,
            credentials: {
                accessKeyId: process.env.STORAGE_S3_KEY || '',
                secretAccessKey: process.env.STORAGE_S3_SECRET || ''
            },
            publicUrlBase: process.env.STORAGE_PUBLIC_URL
          };
      
      this.storage = new MediaManager(StorageFactory.create(storageMode, storageConfig));
    } catch (err: any) {
      this.logger.error(`Failed to initialize storage driver (${storageMode}): ${err.message}. Falling back to minimal local.`);
      const fallbackConfig = { uploadDir: path.resolve(rootDir, 'public/uploads'), publicUrlBase: '/uploads' };
      this.storage = new MediaManager(StorageFactory.create('local', fallbackConfig));
    }

    // Initialize Email
    const emailMode = process.env.SMTP_HOST ? 'smtp' : 'mock';
    try {
      const emailConfig = emailMode === 'smtp' ? {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        }
      } : {};
      this.email = new EmailManager(EmailFactory.create(emailMode, emailConfig));
    } catch (err: any) {
      this.logger.error(`Failed to initialize email driver: ${err.message}. Using MockDriver fallback.`);
      this.email = new EmailManager(EmailFactory.create('mock', {}));
    }

    // Initialize Cache
    const cacheMode = process.env.REDIS_URL ? 'redis' : 'memory';
    try {
      const cacheConfig = cacheMode === 'redis' ? { url: process.env.REDIS_URL } : {};
      this.cache = new CacheManager(CacheFactory.create(cacheMode, cacheConfig));
    } catch (err: any) {
      this.logger.error(`Failed to initialize cache driver: ${err.message}. Using MemoryCache fallback.`);
      this.cache = new CacheManager(CacheFactory.create('memory', {}));
    }
  }

  private getProjectRoot(): string {
    let current = process.cwd();
    while (current !== path.parse(current).root) {
      const pkgPath = path.join(current, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name === '@fromcode/framework') return current;
        } catch {}
      }
      current = path.dirname(current);
    }
    return process.cwd();
  }

  async init() {
    await this.runSystemMigrations();
    await this.coordinator.validateDatabaseState();
    this.registerSystemCollections();
    
    // Sync system collections
    for (const entry of Array.from(this.registeredCollections.values())) {
      if (entry.pluginSlug === 'system') {
        await this.schemaManager.syncCollection(entry.collection);
      }
    }
  }

  private registerSystemCollections() {
    this.logger.info('Registering system collections...');
    
    // Global Record Versions
    this.registeredCollections.set('versions', {
      collection: RecordVersions,
      pluginSlug: 'system'
    });
  }

  async discoverPlugins() {
    this.logger.info(`Scanning for plugins in ${this.pluginsRoot}...`);
    const roots = [this.pluginsRoot];
    
    // Also scan for plugins inside themes
    const rootDir = this.getProjectRoot();
    const themesDir = process.env.THEMES_DIR 
      ? path.resolve(process.env.THEMES_DIR)
      : path.resolve(rootDir, 'themes');

    if (fs.existsSync(themesDir)) {
      const themes = fs.readdirSync(themesDir);
      for (const themeSlug of themes) {
        const themePluginsPath = path.join(themesDir, themeSlug, 'plugins');
        if (fs.existsSync(themePluginsPath) && fs.statSync(themePluginsPath).isDirectory()) {
          this.logger.info(`Adding theme-hosted plugin root: ${themePluginsPath}`);
          roots.push(themePluginsPath);
        }
      }
    }

    const discovered: any[] = [];

    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      const pluginDirs = fs.readdirSync(root);
      
      for (const dir of pluginDirs) {
        if (dir.startsWith('.')) continue;

        const pluginPath = path.join(root, dir);
        if (!fs.statSync(pluginPath).isDirectory()) continue;

        const manifestPath = path.join(pluginPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestContent);
            this.logger.info(`Found manifest for "${manifest.slug}" v${manifest.version}`);

            const indexPath = path.join(pluginPath, manifest.main || 'index.js');
            
            if (fs.existsSync(indexPath)) {
              // Clear require cache
              try {
                  const resolved = require.resolve(indexPath);
                  if (require.cache[resolved]) delete require.cache[resolved];
              } catch (e) {}

              const pluginModule = require(indexPath);
              discovered.push({
                plugin: { manifest, ...pluginModule },
                path: pluginPath
              });
            }
          } catch (err: any) {
            this.logger.warn(`Failed to stage plugin from ${dir}: ${err.message}`);
          }
        }
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
      const row = await this.db.findOne('_system_plugin_settings', { plugin_slug: slug });
      return row?.settings || {};
    } catch (err) {
      return {};
    }
  }

  async savePluginConfig(slug: string, config: any): Promise<void> {
    try {
      const existing = await this.db.findOne('_system_plugin_settings', { plugin_slug: slug });
      if (existing) {
        await this.db.update('_system_plugin_settings', { plugin_slug: slug }, {
          settings: config,
          updated_at: new Date()
        });
      } else {
        await this.db.insert('_system_plugin_settings', {
          plugin_slug: slug,
          settings: config,
          updated_at: new Date()
        });
      }
      
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
      // Use dialect-aware basic table creation
      let createTableSql;
      if (this.db.dialect === 'postgresql') {
        createTableSql = sql`
          CREATE TABLE IF NOT EXISTS _system_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT,
            "group" TEXT,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          )
        `;
      } else if (this.db.dialect === 'mysql') {
        createTableSql = sql`
          CREATE TABLE IF NOT EXISTS _system_meta (
            \`key\` VARCHAR(255) PRIMARY KEY,
            \`value\` TEXT NOT NULL,
            \`description\` TEXT,
            \`group\` VARCHAR(255),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          )
        `;
      } else {
        // SQLite
        createTableSql = sql`
          CREATE TABLE IF NOT EXISTS _system_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            description TEXT,
            "group" TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `;
      }
      
      await this.db.execute(createTableSql);
    } catch (err) {
      this.logger.error('Failed to create system meta table', err);
      return;
    }

    const getVersion = async () => {
      try {
        const row = await this.db.findOne('_system_meta', { key: 'platform_migration_version' });
        return parseInt(row?.value || '0');
      } catch (e) { return 0; }
    };

    const setVersion = async (v: number) => {
      const existing = await this.db.findOne('_system_meta', { key: 'platform_migration_version' });
      if (existing) {
        await this.db.update('_system_meta', { key: 'platform_migration_version' }, {
          value: v.toString(),
          updated_at: new Date()
        });
      } else {
        await this.db.insert('_system_meta', {
          key: 'platform_migration_version',
          value: v.toString(),
          updated_at: new Date()
        });
      }
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
      await this.db.insert('_system_logs', {
        level,
        message,
        plugin_slug: pluginSlug,
        context: context ? (this.db.dialect === 'sqlite' ? JSON.stringify(context) : context) : null,
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
      const result = await this.db.find('_system_plugins', {
        columns: {
          slug: true,
          state: true,
          capabilities: true
        }
      });

      const registry: Record<string, { state: string; approvedCapabilities: string[] }> = {};
      result.forEach((row) => {
        registry[row.slug] = { 
          state: row.state,
          approvedCapabilities: row.capabilities ? (typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities) : []
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
      const values: any = { 
        slug, 
        state, 
        updated_at: new Date() 
      };
      
      if (capabilities) {
        values.capabilities = JSON.stringify(capabilities);
      }
      if (version) {
        values.version = version;
      }

      const existing = await this.db.findOne('_system_plugins', { slug });
      if (existing) {
        await this.db.update('_system_plugins', { slug }, values);
      } else {
        await this.db.insert('_system_plugins', values);
      }
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

    // 2. Permission Registry Check
    // We use PluginPermissionsService to validate that the plugin isn't requesting
    // undefined or illegal permissions before registration.
    const requestedPerms = plugin.manifest.permissions || [];
    requestedPerms.forEach(perm => {
        // Here we could check against a whitelist of valid PluginPermission types
        this.logger.debug(`Plugin "${slug}" requested permission: ${perm}`);
    });

    // 2. Signature verification in production
    if (PluginSignatureService.isEnforced()) {
      let publicKey = '';
      
      // Try to find publisher public key
      const publisherId = (plugin.manifest as any).publisherId;
      if (publisherId) {
        try {
          const publisher = await this.db.findOne('_system_trusted_publishers', {
            publisher_id: publisherId,
            is_active: true
          });
          publicKey = publisher?.public_key || '';
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
        backupPath = await BackupService.create(slug, existing.path, 'plugins');
        this.logger.info(`Created backup at ${backupPath}`);
        
        // Update registry with backup path
        await this.db.update('_system_plugins', { slug }, { 
          backup_path: backupPath, 
          updated_at: new Date() 
        });

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
      await BackupService.downloadAndExtract(pkg.downloadUrl, tempDir);
      
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
          await this.db.update('_system_plugins', { slug }, { 
            has_update: false,
            health_status: 'healthy',
            updated_at: new Date() 
          });
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
    if (!this.plugins.has(slug)) await this.discoverPlugins();
    const plugin = this.plugins.get(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found.`);
    if (plugin.state === 'active') return;

    // Use PluginPermissionsService to enforce base safety
    // For example, ensuring common permissions are declared if used.
    // In this case, we just log that we are initializing a plugin with its declared permissions.
    const declaredPerms = plugin.manifest.permissions || [];
    const declaredCaps = plugin.manifest.capabilities || [];
    this.logger.debug(`Enabling plugin "${slug}" (Perms: ${declaredPerms.join(', ') || 'none'}, Caps: ${declaredCaps.join(', ') || 'none'})`);

    const ctx = this.createContext(plugin);
    
    try {
      plugin.state = 'loading';
      if (plugin.onInit) {
        // Enforce basic permissions if we want to here
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

      await this.db.update('_system_plugins', { slug }, { 
        health_status: 'error', 
        updated_at: new Date() 
      });

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
    await this.db.update('_system_plugins', { slug }, { 
      state: 'error', 
      health_status: 'error', 
      updated_at: new Date() 
    });
      
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
      await this.db.delete('_system_plugins', { slug });
    } catch (err) {
      this.logger.error(`Failed to remove plugin "${slug}" from DB registry`, err);
    }

    // 3. Remove from memory
    const pluginPath = plugin?.path;
    this.plugins.delete(slug);

    // Clear require cache for the plugin's main entry point if we had it
    if (pluginPath) {
      try {
        const manifest = plugin.manifest;
        const indexPath = path.resolve(pluginPath, manifest.main || 'index.js');
        const resolved = require.resolve(indexPath);
        if (require.cache[resolved]) {
          delete require.cache[resolved];
          this.logger.debug(`Cleared require cache for ${slug}`);
        }
      } catch (e) {}
    }

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
    const plugin = this.plugins.get(pluginSlug);
    if (!plugin) return;

    const pluginCollections = Array.from(this.registeredCollections.values())
      .filter(entry => entry.pluginSlug === pluginSlug);

    if (pluginCollections.length === 0) return;

    // Enforce permission check before syncing collections
    if (pluginCollections.length > 0) {
      PluginPermissionsService.ensure(pluginSlug, plugin.manifest, 'database:write');
    }

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
        await BackupService.restore(filePath, tempDir);
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
          await BackupService.create(manifest.slug, targetDir, 'plugins');
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

  async close() {
    this.logger.info('Shutting down Plugin Manager...');
    
    // Disable all active plugins
    for (const [slug, plugin] of this.plugins.entries()) {
      if (plugin.state === 'active') {
        await this.disable(slug);
      }
    }

    // Close Queue Manager (Workers and Connections)
    await this.jobs.close();
    
    this.logger.info('Plugin Manager shut down cleanly.');
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
          .map(c => ({
             ...c.collection,
             pluginSlug: p.manifest.slug
          }));

        return {
          slug: p.manifest.slug,
          name: p.manifest.name,
          admin: {
            ...p.manifest.admin,
            collections
          },
          ui: {
            ...(p.manifest.ui || {}),
            headInjections: []
          }
        };
      });

    // Generate Unified Menu
    const rawMenuItems: any[] = [];

    // Add Themes menu item
    rawMenuItems.push({
      label: 'Themes',
      path: '/themes',
      icon: 'Palette',
      group: 'Platform',
      pluginSlug: 'system',
      priority: 90
    });

    // Add Users menu item explicitly if not present to ensure Roles/Permissions are visible
    rawMenuItems.push({
      label: 'Users',
      path: '/users',
      icon: 'Users',
      group: 'Platform',
      pluginSlug: 'system',
      priority: 80,
      children: [
        { label: 'Roles', path: '/users/roles', icon: 'Shield' },
        { label: 'Permissions', path: '/users/permissions', icon: 'Lock' }
      ]
    });

    rawMenuItems.push({
      label: 'Activity',
      path: '/activity',
      icon: 'Activity',
      group: 'Platform',
      pluginSlug: 'system',
      priority: 85
    });

    // 1. Process explicit menu items from manifests
    pluginMetadata.forEach(p => {
      if (p.admin?.menu) {
        p.admin.menu.forEach(item => {
          // If the path doesn't start with /admin or /content, and it matches a collection name,
          // automatically prefix it with /${pluginSlug}/ to support the framework's routing structure
          let effectivePath = item.path;
          if (effectivePath && !effectivePath.startsWith('/admin/') && !effectivePath.startsWith(`/${p.slug}/`)) {
            const pathSlug = effectivePath.replace(/^\//, '');
            
            // Check both manifest-declared and dynamically registered collections
            const registeredForPlugin = Array.from(this.registeredCollections.values())
              .filter(c => c.pluginSlug === p.slug)
              .map(c => c.collection);

            const hasMatchingCollection = 
              p.admin.collections?.some(col => col.shortSlug === pathSlug || col.slug === pathSlug || (col as any).unprefixedSlug === pathSlug) ||
              registeredForPlugin.some(col => col.shortSlug === pathSlug || col.slug === pathSlug || col.unprefixedSlug === pathSlug);
            
            if (hasMatchingCollection) {
                effectivePath = `/${p.slug}/${pathSlug}`;
                this.logger.debug(`Auto-prefixed menu path for ${item.label}: ${item.path} -> ${effectivePath}`);
            }
          }

          rawMenuItems.push({
            ...item,
            path: effectivePath,
            pluginSlug: p.slug,
            group: item.group || p.admin.group || null
          });
        });
      }

      // 2. Automatically generate menu items for collections
      const collections = Array.from(this.registeredCollections.values())
        .filter(c => c.pluginSlug === p.slug)
        .map(c => c.collection);

      if (collections.length > 0) {
        collections.forEach(col => {
          // Skip if it's a hidden collection or explicitly handled elsewhere
          if (col.admin?.hidden) return;
          if (col.slug === 'settings') return; // Handled by dedicated /settings page
          
          // Use the short slug for the URL to keep it pretty
          const shortSlug = col.shortSlug || col.slug;
          const path = `/${p.slug}/${shortSlug}`;
          const label = col.name || shortSlug.charAt(0).toUpperCase() + shortSlug.slice(1);
          
          // Improved Deduplication: Check for manifest menu items that might already handle this content
          const isExplicitlyHandled = rawMenuItems.some(m => {
             if (m.pluginSlug !== p.slug) return false;
             // Exact path match
             if (m.path === path) return true;
             
             // Custom path that likely refers to the same thing
             const normalizedPath = m.path?.toLowerCase().replace(/^\/[^/]+\//, '').replace(/^\//, '');
             
             if (normalizedPath === shortSlug) return true;
             return false;
          });

          if (!isExplicitlyHandled) {
            const isDuplicate = rawMenuItems.some(m => 
              m.path === path || 
              (m.label.toLowerCase() === label.toLowerCase() && m.pluginSlug === p.slug)
            );

            if (!isDuplicate) {
              rawMenuItems.push({
                label,
                path,
                icon: col.admin?.icon || p.admin.icon || 'FileText',
                group: col.admin?.group || p.admin.group || null,
                priority: col.priority || 100,
                pluginSlug: p.slug
              });
            }
          }
        });
      }
    });

    // 3. Grouping and Final Processing
    const finalMenu: any[] = [];
    const pluginGroupBuckets: Record<string, { pluginSlug: string, groupName: string, items: any[] }> = {};

    // First pass: Bucket items by plugin and group
    rawMenuItems.forEach(item => {
      const gName = item.group || 'Platform';
      const bucketKey = `${item.pluginSlug}:${gName}`;
      if (!pluginGroupBuckets[bucketKey]) {
        pluginGroupBuckets[bucketKey] = { 
            pluginSlug: item.pluginSlug || 'system', 
            groupName: gName, 
            items: [] 
        };
      }
      pluginGroupBuckets[bucketKey].items.push(item);
    });

    // Define groups that should ALWAYS be rendered as sections (flat) for consistency
    const alwaysSectionGroups = ['Platform', 'Content'];

    // Second pass: Process each bucket
    Object.values(pluginGroupBuckets).forEach(bucket => {
      const { pluginSlug, groupName, items } = bucket;
      const plugin = allPlugins.find(p => p.manifest.slug === pluginSlug);
      
      // Determine strategy: Common groups are sections, others default to dropdown for tidiness
      let strategy: 'dropdown' | 'section' = alwaysSectionGroups.includes(groupName) ? 'section' : 'dropdown';
      
      // Override with manifest if provided
      if (plugin?.manifest.admin?.groupStrategy) {
        const gs = plugin.manifest.admin.groupStrategy as any;
        if (typeof gs === 'string') {
          strategy = gs as 'dropdown' | 'section';
        } else if (gs[groupName]) {
          strategy = gs[groupName] as 'dropdown' | 'section';
        }
      }

      if (strategy === 'section') {
        // Flatten items into the final menu
        items.forEach(item => {
          finalMenu.push({
            ...item,
            group: groupName // Ensure group name is preserved for sidebar sectioning
          });
        });
      } else {
        // Dropdown expansion strategy
        const groupIcon = items.find(i => i.icon)?.icon || plugin?.manifest.admin?.icon || 'Layers';
        
        finalMenu.push({
          label: groupName,
          icon: groupIcon,
          group: groupName,
          path: `/#group-${pluginSlug}-${groupName.toLowerCase()}`,
          children: items,
          isGroup: true,
          priority: items[0].priority || 50,
          pluginSlug
        });
      }
    });

    return {
      plugins: pluginMetadata,
      menu: finalMenu.sort((a, b) => (a.priority || 0) - (b.priority || 0))
    };
  }
}
