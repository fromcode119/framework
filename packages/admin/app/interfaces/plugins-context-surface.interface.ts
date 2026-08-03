import type { IAdminPluginMetadata } from '@/app/interfaces/admin-plugin-metadata.interface';

/** The plugins-context surface the plugin loader consumes. */
export interface IPluginsContextSurface {
  plugins: IAdminPluginMetadata[];
  settings: Record<string, any>;
  loadConfig: any;
  registerSlotComponent: any;
  registerCollection: any;
  replaceCollections: any;
  registerSettings: (settings: Record<string, any>) => void;
  registerPlugins: (plugins: IAdminPluginMetadata[]) => void;
  refreshVersion: number;
  triggerRefresh: () => void;
  isReady: boolean;
}
