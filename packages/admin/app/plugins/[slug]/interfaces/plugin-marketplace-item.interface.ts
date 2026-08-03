

export interface IPluginMarketplaceItem {
  slug: string;
  version: string;
  dependencies?: Record<string, string>;
  changelog?: string[];
}
