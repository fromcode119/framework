import type { ILoadedPlugin } from '@core/interfaces/loaded-plugin.interface';
import type { IPluginManifest } from '@core/plugin/interfaces/plugin-manifest.interface';

/** What the installer needs from the plugin manager — narrow, so it can be tested without one. */
export interface ITenantPluginHost {
  plugins: Map<string, ILoadedPlugin>;
  pluginHosts: { isolatesIdentity(siteOwned?: boolean): boolean; reload(slug: string, manifest: Record<string, unknown>): Promise<boolean> } | null;
  discoverPlugins(): Promise<unknown>;
  enable(slug: string, options?: { approve?: readonly string[] }): Promise<unknown>;
  /** New files ask for more than was approved: stop and hold it for approval. True when held. */
  holdIfUnapproved(slug: string, manifest: IPluginManifest): Promise<boolean>;
  delete(slug: string): Promise<void>;
}
