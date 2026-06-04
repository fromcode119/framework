import type { PluginEntry } from '@fromcode119/core/client';

export interface MarketplacePageState {
  plugins: PluginEntry[];
  installedPlugins: any[];
  loading: boolean;
  installing: string | null;
  searchQuery: string;
  imageErrors: Record<string, boolean>;
}
