import type { MarketplacePlugin } from '@core/marketplace/marketplace-plugin';
import type { IMarketplaceTheme } from '@core/marketplace/interfaces/marketplace-theme.interface';

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
