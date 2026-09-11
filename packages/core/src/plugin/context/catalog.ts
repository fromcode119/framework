import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { CoreServices } from '@core/services/core-services';

/**
 * Plugin-facing facade over the catalogue contribution registry.
 *
 * A plugin that produces installable packages — one that builds them from git, say — offers them
 * here, and they appear wherever the marketplace catalogue already appears: the update counter on
 * the Plugins screen, the "update available" badge, the update action. Nothing downstream learns a
 * new concept, and an installation with no marketplace stops answering "0 updates" to a question it
 * was never able to answer.
 *
 * `list` is called whenever the catalogue is read, so it must be cheap: a query over what has
 * already been produced, never a call out to a git host.
 */
export class CatalogContextProxy {
  static createCatalogProxy(plugin: ILoadedPlugin) {
    const namespace = String(plugin?.manifest?.namespace || '').trim();
    const pluginSlug = String(plugin?.manifest?.slug || '').trim();

    return {
      contribute(list: () => Promise<Array<Record<string, unknown>>> | Array<Record<string, unknown>>) {
        CoreServices.getInstance().catalogContributions.register({ namespace, pluginSlug, list });
      },

      withdraw() {
        CoreServices.getInstance().catalogContributions.unregisterByPlugin(namespace, pluginSlug);
      },
    };
  }
}
