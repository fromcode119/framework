export interface IInstalledPluginMarketplaceItem {
  slug: string;
  version: string;
  dependencies?: Record<string, string>;
}
