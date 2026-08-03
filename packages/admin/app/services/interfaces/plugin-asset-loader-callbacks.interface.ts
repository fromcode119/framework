export interface IPluginAssetLoaderCallbacks {
  registerSlotComponent: (slotName: string, component: any, pluginSlug: string, priority: number) => void;
  registerCollection: (collection: any) => void;
  replaceCollections?: (collections: any[]) => void;
}
