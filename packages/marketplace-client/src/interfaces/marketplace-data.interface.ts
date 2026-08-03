import { IMarketplaceCoreInfo } from '@marketplace-client/interfaces/marketplace-core-info.interface';
import type { MarketplacePlugin } from '@marketplace-client/marketplace-plugin';
import type { IMarketplaceTheme } from '@marketplace-client/interfaces/marketplace-theme.interface';
import type { IMarketplaceAppearance } from '@marketplace-client/interfaces/marketplace-appearance.interface';

export interface IMarketplaceData {
  version?: string;
  lastUpdated?: string;
  core?: IMarketplaceCoreInfo;
  plugins: MarketplacePlugin[];
  themes: IMarketplaceTheme[];
  appearances?: IMarketplaceAppearance[];
}
