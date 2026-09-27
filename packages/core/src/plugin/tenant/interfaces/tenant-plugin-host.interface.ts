import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';

/** What the installer needs from the plugin manager — narrow, so it can be tested without one. */
export interface ITenantPluginHost {
  plugins: Map<string, ILoadedPlugin>;
  pluginHosts: { isolatesIdentity(): boolean; reload(slug: string, manifest: Record<string, unknown>): Promise<boolean> } | null;
  discoverPlugins(): Promise<unknown>;
  enable(slug: string): Promise<unknown>;
  delete(slug: string): Promise<void>;
}
