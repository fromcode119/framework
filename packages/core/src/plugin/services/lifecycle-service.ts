import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { Logger } from '../../logging';
import { LoadedPlugin, FromcodePlugin } from '../../types';
import { SystemConstants } from '../../constants';
import type { PluginManagerInterface } from '../context/utils.interfaces';
import { PluginPermissionsService } from '../../security/plugin-permissions-service';
import { PluginSignatureService } from '../../security/plugin-signature-service';
import { PluginStateService } from './plugin-state-service';
import { DiscoveryService } from './discovery-service';
import { SchemaManager } from '../../database/schema-manager';

import { ManifestValidator } from '../../management/manifest';
import { SandboxManager } from '../../security/sandbox-manager';
import { IntegrityService } from '../../security/integrity-service';
import { Seeder } from '../../database/seeder';
import { CoreServices } from '../../services/core-services';

export class LifecycleService {
  private logger = new Logger({ namespace: 'lifecycle-service' });
  private sandbox?: SandboxManager;
  private seeder: Seeder;

  constructor(
    private manager: PluginManagerInterface,
    private registry: PluginStateService,
    private discovery: DiscoveryService,
    private schemaManager: SchemaManager
  ) {
    this.seeder = new Seeder(manager.db);
    try {
      this.sandbox = new SandboxManager();
    } catch (e) {
      this.logger.warn('SandboxManager failed to initialize (isolated-vm might not be supported in this environment)');
    }
  }

  public async getSandboxStats() {
    return this.sandbox ? await this.sandbox.getStats() : null;
  }

  async register(plugin: FromcodePlugin, pluginPath?: string): Promise<void> {
    const slug = plugin.manifest.slug;
    const existingEntry = this.manager.plugins.get(slug);
    
    // Only throw if the plugin is already registered AND it's not in an error state.
    // If it's in an error state, we want to allow re-registration to attempt recovery.
    if (existingEntry && existingEntry.state !== 'error') {
      throw new Error(`Plugin with slug "${slug}" is already registered.`);
    }

    try {
      ManifestValidator.validate(plugin.manifest);
    } catch (err) {
      throw new Error(`Invalid manifest for "${slug}": ${err}`);
    }

    // Integrity Check
    if (pluginPath && plugin.manifest.checksum) {
      const isHealthy = await IntegrityService.verifyPluginIntegrity(pluginPath, plugin.manifest.checksum);
      if (!isHealthy) {
        throw new Error(`Security Violation: Integrity check failed for plugin "${slug}"`);
      }
    }

    if (PluginSignatureService.isEnforced()) {
      const isValid = PluginSignatureService.verify(plugin.manifest, plugin.manifest.signature || '', '');
      if (!isValid) {
        throw new Error(`Security Violation: Invalid signature for plugin "${slug}"`);
      }
    }

    this.discovery.validateDependencies(plugin.manifest, this.manager.plugins);

    const registryData = await this.registry.loadInstalledPluginsState();
    const normSlug = slug.toLowerCase();
    const saved = registryData[normSlug];
    let state = saved?.state || 'inactive';

    if (state === 'active') {
      const currentCaps = [...(plugin.manifest.capabilities || [])].sort().join(',');
      const approvedCaps = [...(saved?.approvedCapabilities || [])].sort().join(',');

      if (currentCaps !== approvedCaps) {
        state = 'inactive';
        await this.registry.savePluginState(slug, 'inactive', undefined, plugin.manifest.version); 
      }
    }

    const loadedPlugin: LoadedPlugin = {
      ...plugin,
      instanceId: uuidv4(),
      state: 'inactive',
      path: pluginPath,
      approvedCapabilities: saved?.approvedCapabilities || [],
      healthStatus: saved?.healthStatus || 'healthy'
    };

    // Override manifest sandbox config with database-stored values if they exist
    const hasSavedSandboxConfig = !!saved && Object.prototype.hasOwnProperty.call(saved, 'sandboxConfig') && saved.sandboxConfig !== undefined;
    if (hasSavedSandboxConfig) {
      if (saved!.sandboxConfig === false) {
        loadedPlugin.manifest.sandbox = false;
      } else if (!loadedPlugin.manifest.sandbox || typeof loadedPlugin.manifest.sandbox === 'boolean') {
        loadedPlugin.manifest.sandbox = saved!.sandboxConfig;
      } else {
        loadedPlugin.manifest.sandbox = { ...loadedPlugin.manifest.sandbox, ...saved!.sandboxConfig };
      }
    }

    loadedPlugin.manifest.config = await this.registry.getPluginConfig(slug);
    this.manager.plugins.set(slug, loadedPlugin);
    
    // Discovery-phase initialization: keep this in host context for all plugins.
    // Existing plugins rely on onInit() to register collections/settings/routes.
    const ctx = (this.manager as any).createContext(loadedPlugin);
    try {
      if (loadedPlugin.onInit) await loadedPlugin.onInit(ctx);
    } catch (err: any) {
      this.rollbackFailedRegistration(loadedPlugin);
      this.logger.error(`Error during onInit for plugin "${slug}": ${err.message}`, err.stack);
      throw new Error(`Plugin "${slug}" failed during onInit: ${err.message}`);
    }

    await this.registry.savePluginState(slug, state, saved ? undefined : (plugin.manifest.capabilities as string[]), plugin.manifest.version);

    if (state === 'active') {
      await this.enable(slug);
    }
  }

  async enable(slug: string, options: { force?: boolean, recursive?: boolean } = {}): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found.`);
    if (plugin.state === 'active') {
      if (options.force) {
        this.logger.info(`Plugin "${slug}" already active; forcing collection schema sync.`);
        await this.syncPluginCollections(slug);
      }
      return;
    }

    // Dependency Validation
    if (!options.force) {
      const issues = this.discovery.checkDependencies(plugin.manifest, this.manager.plugins, { checkActive: true });
      
      if (issues.length > 0) {
        if (options.recursive) {
          for (const issue of issues) {
            if (issue.type === 'inactive') {
              this.logger.info(`Recursively enabling dependency "${issue.slug}" for "${slug}"...`);
              await this.enable(issue.slug, options);
            } else if (issue.type === 'missing') {
              // Check if we can download it? For now, just throw.
              throw new Error(`Dependency "${issue.slug}" is missing and required by "${slug}".`);
            } else if (issue.type === 'incompatible') {
              throw new Error(`Incompatible dependency: "${slug}" requires "${issue.slug}" version "${issue.expected}", but found "${issue.actual}".`);
            }
          }
        } else {
          // We throw a structured error message that the controller can catch
          throw new Error(`DEPENDENCY_ISSUES: ${JSON.stringify(issues)}`);
        }
      }
    }

    const ctx = (this.manager as any).createContext(plugin);
    
    try {
      plugin.state = 'loading';
      
      if (plugin.isSandboxed && plugin.entryPath && this.sandbox) {
        this.logger.info(`Initializing sandbox for "${slug}"...`);
        await this.sandbox.initPluginContext(slug, ctx, plugin.manifest);
        // Compatibility mode: keep plugin lifecycle execution in host context.
        // The current plugin model is module-based and depends on host context registration.
        if (plugin.onEnable) await plugin.onEnable(ctx);
      } else {
        if (plugin.onEnable) await plugin.onEnable(ctx);
      }
      
      await this.syncPluginCollections(slug);
      await this.runSeeds(slug);

      plugin.state = 'active';
      const currentCaps = plugin.manifest.capabilities as string[] || [];
      plugin.approvedCapabilities = currentCaps;
      
      await this.registry.savePluginState(slug, 'active', currentCaps, plugin.manifest.version);
      await this.registry.writeLog('INFO', `Plugin "${slug}" successfully enabled.`, slug);
    } catch (error) {
      plugin.state = 'error';
      await this.registry.writeLog('ERROR', `Initialization failed for "${slug}": ${error}`, slug);
      throw error;
    }
  }

  private async runSeeds(slug: string) {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin || !plugin.manifest.seeds || !plugin.path) return;

    const seedPath = path.resolve(plugin.path, plugin.manifest.seeds);
    if (fs.existsSync(seedPath)) {
      this.logger.info(`Running seeds for plugin "${slug}"...`);
      try {
        await this.seeder.seed(seedPath);
      } catch (err: any) {
        this.logger.error(`Failed to run seeds for plugin "${slug}": ${err.message}`);
      }
    }
  }

  async disable(slug: string, options: { persistState?: boolean } = {}): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin || plugin.state !== 'active') return;

    // Check if any active plugins depend on this one
    const activeDependents = Array.from(this.manager.plugins.values()).filter(p => 
      p.state === 'active' && 
      p.manifest.dependencies && 
      p.manifest.dependencies[slug]
    );
    
    if (activeDependents.length > 0) {
      const dependentNames = activeDependents.map(p => p.manifest.slug).join(', ');
      throw new Error(
        `Cannot disable plugin "${slug}" because it is required by active plugins: ${dependentNames}. ` +
        `Please disable those plugins first.`
      );
    }

    const ctx = (this.manager as any).createContext(plugin);
    try {
      if (plugin.isSandboxed && this.sandbox) {
        this.sandbox.disposePluginContext(slug);
      } else {
        if (plugin.onDisable) await plugin.onDisable(ctx);
      }
      plugin.state = 'inactive';
      if (options.persistState !== false) {
        await this.registry.savePluginState(slug, 'inactive', undefined, plugin.manifest.version);
        await this.registry.writeLog('INFO', `Plugin "${slug}" disabled.`, slug);
      }
    } catch (error) {
      this.logger.error(`Error disabling plugin "${slug}": ${error}`);
    }
  }

  async delete(slug: string): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (plugin) {
      const dependents = Array.from(this.manager.plugins.values()).filter(p => 
        p.manifest.dependencies && p.manifest.dependencies[slug]
      );
      if (dependents.length > 0) {
        throw new Error(`Cannot delete plugin "${slug}" because it is required by: ${dependents.map(p => p.manifest.slug).join(', ')}`);
      }
      if (plugin.state === 'active') await this.disable(slug);
    }

    await this.manager.db.delete(SystemConstants.TABLE.PLUGINS, { slug });
    const pluginPath = plugin?.path;
    this.manager.plugins.delete(slug);

    if (pluginPath) {
      try {
        const manifest = plugin!.manifest;
        const indexPath = path.resolve(pluginPath, manifest.main || 'index.js');
        const resolved = require.resolve(indexPath);
        if (require.cache[resolved]) delete require.cache[resolved];
      } catch (e) {}
    }

    for (const [colSlug, entry] of this.manager.registeredCollections.entries()) {
      if (entry.pluginSlug === slug) this.manager.registeredCollections.delete(colSlug);
    }

    try {
        const targetPath = pluginPath;
        if (targetPath && fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, { recursive: true, force: true });
        }
    } catch (e) {}
  }

  private async syncPluginCollections(pluginSlug: string) {
    const plugin = this.manager.plugins.get(pluginSlug);
    if (!plugin) return;

    const pluginCollections = Array.from(this.manager.registeredCollections.values())
      .filter(entry => entry.pluginSlug === pluginSlug);

    if (pluginCollections.length > 0) {
      PluginPermissionsService.ensure(pluginSlug, plugin.manifest, 'database:write');
      for (const { collection } of pluginCollections) {
        await this.schemaManager.syncCollection(collection);
      }
    }
  }

  private rollbackFailedRegistration(plugin: LoadedPlugin): void {
    this.manager.plugins.delete(plugin.manifest.slug);
    this.manager.headInjections.delete(plugin.manifest.slug);

    for (const [collectionSlug, entry] of this.manager.registeredCollections.entries()) {
      if (entry.pluginSlug === plugin.manifest.slug) {
        this.manager.registeredCollections.delete(collectionSlug);
      }
    }

    const pluginNamespace = String(plugin.manifest.namespace || '').trim();
    if (pluginNamespace) {
      CoreServices.getInstance().defaultPageContracts.unregisterByPlugin(
        pluginNamespace,
        plugin.manifest.slug,
      );
    }
  }
}
