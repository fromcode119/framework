import type { AdminPluginMetadata } from '../plugin-loader.interfaces';

export interface PluginAssetLoaderCallbacks {
  registerSlotComponent: (slotName: string, component: any, pluginSlug: string, priority: number) => void;
  registerCollection: (collection: any) => void;
  replaceCollections?: (collections: any[]) => void;
}

export interface PluginAssetLoaderContext {
  plugins: AdminPluginMetadata[];
  refreshVersion: number;
  callbacks: PluginAssetLoaderCallbacks;
}
