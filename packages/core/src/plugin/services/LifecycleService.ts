import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { Logger } from '../../logging/logger';
import { LoadedPlugin, FromcodePlugin } from '../../types';
import { PluginManagerInterface } from '../context';
import { PluginPermissionsService } from '../../security/permissions';
import { PluginSignatureService } from '../../security/signature';
import { PluginStateService } from './PluginStateService';
import { DiscoveryService } from './DiscoveryService';
import { SchemaManager } from '../../database/schema-manager';

import { validatePluginManifest as validateManifest } from '../../management/manifest';
import { SandboxManager } from '../../security/SandboxManager';
import { IntegrityService } from '../../security/IntegrityService';

export class LifecycleService {
  private logger = new Logger({ namespace: 'LifecycleService' });
  private sandbox?: SandboxManager;

  constructor(
    private manager: PluginManagerInterface,
    private registry: PluginStateService,
    private discovery: DiscoveryService,
    private schemaManager: SchemaManager
  ) {
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
      validateManifest(plugin.manifest);
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
    const saved = registryData[slug];
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
    if (saved?.sandboxConfig) {
      if (!loadedPlugin.manifest.sandbox || typeof loadedPlugin.manifest.sandbox === 'boolean') {
        loadedPlugin.manifest.sandbox = saved.sandboxConfig;
      } else {
        loadedPlugin.manifest.sandbox = { ...loadedPlugin.manifest.sandbox, ...saved.sandboxConfig };
      }
    }

    loadedPlugin.manifest.config = await this.registry.getPluginConfig(slug);
    this.manager.plugins.set(slug, loadedPlugin);
    
    await this.registry.savePluginState(slug, state, saved ? undefined : (plugin.manifest.capabilities as string[]), plugin.manifest.version);

    if (state === 'active') {
      await this.enable(slug);
    }
  }

  async enable(slug: string): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found.`);
    if (plugin.state === 'active') return;

    const ctx = (this.manager as any).createContext(plugin);
    
    try {
      plugin.state = 'loading';
      
      if (plugin.isSandboxed && plugin.entryPath && this.sandbox) {
        this.logger.info(`Initializing sandbox for "${slug}"...`);
        await this.sandbox.initPluginContext(slug, ctx, plugin.manifest);
        
        const code = fs.readFileSync(plugin.entryPath, 'utf8');
        await this.sandbox.runInPluginContext(slug, code);
      } else {
        if (plugin.onInit) await plugin.onInit(ctx);
        if (plugin.onEnable) await plugin.onEnable(ctx);
      }
      
      await this.syncPluginCollections(slug);

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

  async disable(slug: string): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin || plugin.state !== 'active') return;

    const ctx = (this.manager as any).createContext(plugin);
    try {
      if (plugin.isSandboxed && this.sandbox) {
        this.sandbox.disposePluginContext(slug);
      } else {
        if (plugin.onDisable) await plugin.onDisable(ctx);
      }
      plugin.state = 'inactive';
      await this.registry.savePluginState(slug, 'inactive', undefined, plugin.manifest.version);
      await this.registry.writeLog('INFO', `Plugin "${slug}" disabled.`, slug);
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

    await this.manager.db.delete('_system_plugins', { slug });
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
}
