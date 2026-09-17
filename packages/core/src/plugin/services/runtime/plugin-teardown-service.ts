import { PluginArchiveInstallerService } from '@core/plugin/services/installation/plugin-archive-installer-service';
import { PluginPackageLayout } from '@core/plugin/plugin-package-layout';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';
import { SystemConstants } from '@core/constants/system.constants';
import { PluginDirectoryAction } from '@core/plugin/services/installation/enums/plugin-directory-action.enum';

/**
 * Taking a plugin OUT: disabling it, and deleting it entirely.
 *
 * Disable persists by default but does not have to — a plugin disabled because it FAILED is held in
 * memory without writing that over the operator's intent, so a fixed plugin comes back where they
 * left it rather than where a crash put it.
 *
 * Delete is the irreversible one, which is why it runs the plugin's own `onUninstall` first and only
 * then removes the row: a plugin that needs to clean up after itself gets the chance while its
 * tables and settings still exist.
 *
 * Split out of `LifecycleService`, which keeps registration and enabling.
 */
export class PluginTeardownService {
  constructor(
    private readonly manager: any,
    private readonly registry: any,
    private readonly activation: any,
    private readonly logger: any,
  ) {}

  async disable(slug: string, options: { persistState?: boolean } = {}): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (!plugin || plugin.state !== PluginState.ACTIVE) return;

    // Check if any active plugins depend on this one
    const activeDependents = Array.from(this.manager.plugins.values()).filter((p: any) => 
      p.state === PluginState.ACTIVE && 
      p.manifest.dependencies && 
      p.manifest.dependencies[slug]
    );
    
    if (activeDependents.length > 0) {
      const dependentNames = activeDependents.map((p: any) => p.manifest.slug).join(', ');
      throw new Error(
        `Cannot disable plugin "${slug}" because it is required by active plugins: ${dependentNames}. ` +
        `Please disable those plugins first.`
      );
    }

    if (plugin.manifest?.bundled === true) {
      throw new Error(
        `Cannot disable "${slug}": it is part of the framework, not an installed plugin. `
        + 'Bundled extensions ship inside the image and are always available.',
      );
    }

    const ctx = (this.manager as any).createContext(plugin);
    try {
      if (plugin.onDisable) await plugin.onDisable(ctx);
      plugin.state = PluginState.INACTIVE;
      this.manager.middlewares.unregisterByPlugin(slug);
      if (options.persistState !== false) {
        await this.registry.savePluginState(slug, PluginState.INACTIVE, undefined, plugin.manifest.version);
        await this.registry.writeLog('INFO', `Plugin "${slug}" disabled.`, slug);
      }
    } catch (error) {
      this.logger.error(`Error disabling plugin "${slug}": ${error}`);
    }
  }

  async delete(slug: string): Promise<void> {
    const plugin = this.manager.plugins.get(slug);
    if (plugin?.manifest?.bundled === true) {
      throw new Error(
        `Cannot remove "${slug}": it ships with the framework. Removing it would delete part of the `
        + 'image, and the next container start would bring it back anyway.',
      );
    }
    if (plugin) {
      // Never `rm -rf` a developer's mounted source checkout from the admin (see PluginArchiveInstallerService).
      PluginArchiveInstallerService.refuseSourceCheckout(String(plugin.path || ''), slug, PluginDirectoryAction.DELETE);
      const dependents = Array.from(this.manager.plugins.values()).filter((p: any) =>
        p.manifest.dependencies && p.manifest.dependencies[slug]
      );
      if (dependents.length > 0) {
        throw new Error(`Cannot delete plugin "${slug}" because it is required by: ${dependents.map((p: any) => p.manifest.slug).join(', ')}`);
      }
      if (plugin.state === PluginState.ACTIVE) await this.disable(slug);

      if (plugin.onUninstall) {
        const ctx = (this.manager as any).createContext(plugin);
        try {
          await plugin.onUninstall(ctx);
        } catch (err: any) {
          this.logger.error(`Error during onUninstall for plugin "${slug}": ${err.message}`);
        }
      }
      // T5: a plugin's process goes with it — after onDisable/onUninstall ran inside it.
      await this.manager.pluginHosts?.stop(slug);
    }

    await this.manager.db.delete(SystemConstants.TABLE.PLUGINS, { slug });
    const pluginPath = plugin?.path;
    this.manager.plugins.delete(slug);
    this.manager.middlewares.unregisterByPlugin(slug);

    this.activation.cleanupAfterDelete(slug, pluginPath, plugin?.manifest.main || PluginPackageLayout.SERVER_ENTRY);
  }
}
