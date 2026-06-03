import type { MarketplaceTheme } from '@fromcode119/core/client';

export interface ThemeMarketplaceDetailPageProps {
  params: Promise<{ slug: string }>;
}

export interface ThemeMarketplaceDetailPageState {
  routeSlug: string;
  resolved: boolean;
  theme: MarketplaceTheme | null;
  allVersions: MarketplaceTheme[];
  selectedVersion: string;
  installedTheme: any | null;
  loading: boolean;
  installing: boolean;
  activeImageIndex: number;
  showLightbox: boolean;
}
