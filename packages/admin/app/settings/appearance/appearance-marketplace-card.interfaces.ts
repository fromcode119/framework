import type { AppearanceCatalogItem } from './appearance-catalog-item.interfaces';

export interface AppearanceMarketplaceCardProps {
  entries: AppearanceCatalogItem[];
  busy: boolean;
  dark: boolean;
  onInstall: (slug: string) => void;
}
