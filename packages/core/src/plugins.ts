import { PluginsFacade } from './plugins-facade';
import { RuntimePluginsResolver } from './runtime-plugins-resolver';

export class Plugins {
  private static instance: PluginsFacade | null = null;

  static namespace(namespace: string): any {
    return Plugins.getInstance().namespace(namespace);
  }

  static getInstance(): PluginsFacade {
    if (!Plugins.instance) {
      Plugins.instance = new PluginsFacade(new RuntimePluginsResolver());
    }

    return Plugins.instance;
  }
}
