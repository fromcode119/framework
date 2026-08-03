import type { MarketplacePlugin } from '@core/interfaces/marketplace-plugin.interface';
import type { IMarketplaceTheme } from '@core/interfaces/marketplace-theme.interface';

export interface IMarketplaceData {
  version?: string;
  lastUpdated?: string;
  core?: {
    version: string;
    downloadUrl: string;
    lastUpdated: string;
  };
  plugins: MarketplacePlugin[];
  themes: IMarketplaceTheme[];
}
