import type { PluginApiResolver } from './plugin-api-resolver.interfaces';
import type { LoadedPlugin } from './types';

export class PluginsManagerResolver implements PluginApiResolver {
  constructor(private readonly plugins: Map<string, LoadedPlugin>) {}

  has(namespace: string, slug: string): boolean {
    return this.resolve(namespace, slug) !== undefined;
  }

  resolve(namespace: string, slug: string): unknown {
    const normalizedNamespace = String(namespace || '').trim().toLowerCase();
    const normalizedSlug = String(slug || '').trim().toLowerCase();

    for (const plugin of this.plugins.values()) {
      if (plugin.state !== 'active' || !plugin.publicAPI) {
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
