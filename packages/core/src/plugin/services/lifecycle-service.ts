import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../logging';
import { LoadedPlugin, FromcodePlugin } from '../../types';
import { SystemConstants } from '../../constants';
import type { PluginManagerInterface } from '../context/utils.interfaces';
import { PluginStateService } from './plugin-state-service';
import { DiscoveryService } from './discovery-service';
import { SchemaManager } from '../../database/schema-manager';

import { ManifestValidator } from '../../management/manifest';
import { SandboxManager } from '../../security/sandbox-manager';
import { Seeder } from '../../database/seeder';
import { PluginFailureIsolationService } from './plugin-failure-isolation-service';
import { PluginCollectionActivationService } from './plugin-collection-activation-service';
import { PluginRegistrationSecurityService } from './plugin-registration-security-service';

export class LifecycleService {
  private logger = new Logger({ namespace: 'lifecycle-service' });
  private sandbox?: SandboxManager;
  private seeder: Seeder;
  private failureIsolation: PluginFailureIsolationService;
  private activation: PluginCollectionActivationService;

  constructor(
    private manager: PluginManagerInterface,
    private registry: PluginStateService,
    private discovery: DiscoveryService,
    private schemaManager: SchemaManager
  ) {
    this.seeder = new Seeder(manager.db);
    this.failureIsolation = new PluginFailureIsolationService(manager, registry, this.logger);
    this.activation = new PluginCollectionActivationService(manager, schemaManager, this.seeder, this.logger);
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

    await PluginRegistrationSecurityService.verify(plugin, pluginPath, this.logger);

    this.discovery.validateDependencies(plugin.manifest, this.manager.plugins);

    const registryData = await this.registry.loadInstalledPluginsState();
    const normSlug = slug.toLowerCase();
    const saved = registryData[normSlug];
    let state = saved?.state || 'inactive';

    // Failures now only flip health_status to 'error' and PRESERVE the desired `state`
    // (see PluginStateService.markPluginHealthError), so saved.state is normally a real
    // 'active' | 'inactive' value and the plugin recovers to exactly where it was: an
    // active plugin re-enables below, an inactive one stays inactive. This branch is a
    // defensive fallback for legacy rows persisted with state='error' before that change —
    // recover them conservatively to 'inactive' rather than guess. A tampered/malicious
    // plugin never reaches here (the integrity check above throws first).
    if (state === 'error') {
      state = 'inactive';
    }

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

    const isFreshInstall = !saved;
    const savedVersion = saved?.version;
    const isVersionUpdate = !isFreshInstall && !!savedVersion && savedVersion !== plugin.manifest.version;
    const ctx = (this.manager as any).createContext(loadedPlugin);
    try {
      if (isFreshInstall && loadedPlugin.onInstall) await loadedPlugin.onInstall(ctx);
      if (isVersionUpdate && loadedPlugin.onUpdate && savedVersion) {
        await loadedPlugin.onUpdate(ctx, { oldVersion: savedVersion, newVersion: plugin.manifest.version });
      }
      if (loadedPlugin.onInit) await loadedPlugin.onInit(ctx);
    } catch (err: any) {
      this.failureIsolation.rollbackPartialRegistration(loadedPlugin);
      await this.failureIsolation.markPluginError(loadedPlugin, err.message);
      const hook = isFreshInstall ? 'onInstall/onInit' : isVersionUpdate ? 'onUpdate/onInit' : 'onInit';
      this.logger.error(`Error during ${hook} for plugin "${slug}": ${err.message}`, err.stack);
      throw new Error(`Plugin "${slug}" failed during ${hook}: ${err.message}`);
    }

    if (state === 'active') {
      try {
        await this.enable(slug);
      } catch (err: any) {
        await this.failureIsolation.markPluginError(loadedPlugin, err.message);
        throw err;
      }
      return;
    }

    // Registration succeeded: clear any stale health-error carried over from a prior
    // failure so a recovered (now inactive) plugin reports healthy. savePluginState
    // persists health='healthy' for any non-error state. (The active path resets these
    // inside enable().)
    loadedPlugin.healthStatus = 'healthy';
    loadedPlugin.error = undefined;
    await this.registry.savePluginState(slug, state, saved ? undefined : (plugin.manifest.capabilities as string[]), plugin.manifest.version);
  }

  async enable(slug: string, options: { force?: boolean, recursive?: boolean } = {}): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found.`);
    if (plugin.state === 'active') {
      if (options.force) {
        this.logger.info(`Plugin "${slug}" already active; forcing collection schema sync.`);
        await this.activation.syncPluginCollections(slug);
      }
      return;
    }

    if (!options.force) {
      const issues = this.discovery.checkDependencies(plugin.manifest, this.manager.plugins, { checkActive: true });
      
      if (issues.length > 0) {
        if (options.recursive) {
          for (const issue of issues) {
            if (issue.type === 'inactive') {
              this.logger.info(`Recursively enabling dependency "${issue.slug}" for "${slug}"...`);
              await this.enable(issue.slug, options);
            } else if (issue.type === 'missing') {
              throw new Error(`Dependency "${issue.slug}" is missing and required by "${slug}".`);
            } else if (issue.type === 'incompatible') {
              throw new Error(`Incompatible dependency: "${slug}" requires "${issue.slug}" version "${issue.expected}", but found "${issue.actual}".`);
            }
          }
        } else {
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
        if (plugin.onEnable) await plugin.onEnable(ctx);
      } else {
        if (plugin.onEnable) await plugin.onEnable(ctx);
      }
      await this.activation.autoDiscoverCollections(plugin, ctx);
      await this.activation.syncPluginCollections(slug);
      await this.activation.runSeeds(slug);
      await this.activation.materializeDefaultPages();

      plugin.state = 'active';
      plugin.error = undefined;
      plugin.healthStatus = 'healthy';
      const currentCaps = plugin.manifest.capabilities as string[] || [];
      plugin.approvedCapabilities = currentCaps;
      
      await this.registry.savePluginState(slug, 'active', currentCaps, plugin.manifest.version);
      await this.registry.writeLog('INFO', `Plugin "${slug}" successfully enabled.`, slug);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.failureIsolation.markPluginError(plugin, message);
      throw error;
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
      this.manager.middlewares.unregisterByPlugin(slug);
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

      if (plugin.onUninstall) {
        const ctx = (this.manager as any).createContext(plugin);
        try {
          await plugin.onUninstall(ctx);
        } catch (err: any) {
          this.logger.error(`Error during onUninstall for plugin "${slug}": ${err.message}`);
        }
      }
    }

    await this.manager.db.delete(SystemConstants.TABLE.PLUGINS, { slug });
    const pluginPath = plugin?.path;
    this.manager.plugins.delete(slug);
    this.manager.middlewares.unregisterByPlugin(slug);

    this.activation.cleanupAfterDelete(slug, pluginPath, plugin?.manifest.main || 'index.js');
  }
}
