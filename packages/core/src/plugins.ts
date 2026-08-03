import type { IPluginApiResolver } from '@core/interfaces/plugin-api-resolver.interface';
import { PluginsFacade } from '@core/plugins-facade';
import { RuntimePluginsResolver } from '@core/runtime-plugins-resolver';
import type { NamespacedPluginsFacade } from '@core/namespaced-plugins-facade';

export class Plugins {
  private static instance: PluginsFacade | null = null;
  private static resolver: IPluginApiResolver | null = null;

  static namespace(namespace: string): NamespacedPluginsFacade {
    return Plugins.getInstance().namespace(namespace);
  }

  static setResolver(resolver: IPluginApiResolver | null): void {
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
