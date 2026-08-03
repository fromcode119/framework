import type { IPluginApiResolver } from '@core/interfaces/plugin-api-resolver.interface';
import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import { PluginState } from '@core/plugin/services/enums/plugin-state.enum';

export class PluginsManagerResolver implements IPluginApiResolver {
  constructor(private readonly plugins: Map<string, ILoadedPlugin>) {}

  has(namespace: string, slug: string): boolean {
    return this.resolve(namespace, slug) !== undefined;
  }

  resolve(namespace: string, slug: string): unknown {
    const normalizedNamespace = String(namespace || '').trim().toLowerCase();
    const normalizedSlug = String(slug || '').trim().toLowerCase();

    for (const plugin of this.plugins.values()) {
      if (plugin.state !== PluginState.ACTIVE || !plugin.publicAPI) {
        continue;
      }

      const pluginNamespace = String(plugin.manifest.namespace || '').trim().toLowerCase();
      const pluginSlug = String(plugin.manifest.slug || '').trim().toLowerCase();
      if (pluginNamespace === normalizedNamespace && pluginSlug === normalizedSlug) {
        return plugin.publicAPI;
      }
    }

    return undefined;
  }
}
