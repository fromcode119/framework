import type { MarketplaceTheme } from '@fromcode119/core/client';

export interface ThemesMarketplacePageState {
  themes: MarketplaceTheme[];
  installedThemes: any[];
  loading: boolean;
}
