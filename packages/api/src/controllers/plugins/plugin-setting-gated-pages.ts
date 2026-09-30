import { CoreServices, Logger, PluginManager } from '@fromcode119/core';
import type { ILoadedPlugin } from '@fromcode119/core';

/**
 * A page contract gated by a plugin setting (`enabledBySetting`) is created when a site turns that
 * setting on: the operator switches the feature on and its page appears on that site, without waiting
 * for the next boot or plugin activation. Runs inside the save request, so it materializes for the site
 * being edited only.
 */
export class PluginSettingGatedPages {
  constructor(private readonly manager: PluginManager, private readonly logger: Logger) {}

  async afterSave(plugin: ILoadedPlugin, oldSettings: Record<string, any>, newSettings: Record<string, any>): Promise<void> {
    const contracts = CoreServices.getInstance().defaultPageContracts.listByPlugin(
      String(plugin.manifest.namespace || ''),
      String(plugin.manifest.slug || ''),
    );
    const switchedOn = contracts.some((contract) => {
      const setting = contract.enabledBySetting;
      return Boolean(setting) && newSettings?.[setting!] === true && oldSettings?.[setting!] !== true;
    });
    if (!switchedOn) return;
    try {
      await this.manager.materializeDefaultPages();
    } catch (error: any) {
      this.logger.error(`Creating the pages "${plugin.manifest.slug}" switched on failed: ${error?.message || error}`);
    }
  }
}
