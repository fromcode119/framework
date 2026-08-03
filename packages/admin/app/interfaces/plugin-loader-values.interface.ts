import type { IPluginsContextSurface } from '@/app/interfaces/plugins-context-surface.interface';

/** Hook values the {@link PluginLoader} bridge reads and forwards to its runner. */
export interface IPluginLoaderValues {
  pluginsContext: IPluginsContextSurface;
  user: unknown;
  isAuthLoading: boolean;
}
