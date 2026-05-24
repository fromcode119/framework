import type { PluginApiResolver } from './plugin-api-resolver.interfaces';
import { PluginsFacade } from './plugins-facade';
import { RuntimePluginsResolver } from './runtime-plugins-resolver';
import type { NamespacedPluginsFacade } from './namespaced-plugins-facade';

export class Plugins {
  private static instance: PluginsFacade | null = null;
  private static resolver: PluginApiResolver | null = null;

  static namespace(namespace: string): NamespacedPluginsFacade {
    return Plugins.getInstance().namespace(namespace);
  }

  static setResolver(resolver: PluginApiResolver | null): void {
    Plugins.resolver = resolver;
    Plugins.instance = resolver ? new PluginsFacade(resolver) : null;
  }

  static getInstance(): PluginsFacade {
    if (!Plugins.instance) {
      Plugins.instance = new PluginsFacade(Plugins.resolver || new RuntimePluginsResolver());
    }

    return Plugins.instance;
  }
}
