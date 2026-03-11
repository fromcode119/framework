import type {
  MarketplaceChangelogEntry,
  MarketplaceCoreInfo,
  MarketplaceRating,
  ScreenshotEntry,
} from './marketplace-client.types';

export interface MarketplacePlugin {
  slug: string;
  name: string;
  version: string;
  description: string;
  downloadUrl: string;
  category: string;
  author: string;
  homepage?: string;
  iconUrl?: string;
  capabilities?: string[];
  dependencies?: Record<string, string>;
  screenshots?: ScreenshotEntry[];
  changelog?: any[];
  isFeatured?: boolean;
  isTrending?: boolean;
  isVerified?: boolean;
  downloads?: number;
  rating?: MarketplaceRating;
}

export interface MarketplaceTheme {
  slug: string;
  name: string;
  version: string;
  description: string;
  iconUrl?: string;
  screenshots?: ScreenshotEntry[];
  author: string;
  authorUrl?: string;
  downloadUrl?: string;
  previewUrl?: string;
  dependencies?: Record<string, string>;
  labels?: string[];
  isFeatured?: boolean;
  downloads?: number;
  changelog?: MarketplaceChangelogEntry[];
}

export interface MarketplaceData {
  version?: string;
  lastUpdated?: string;
  core?: MarketplaceCoreInfo;
  plugins: MarketplacePlugin[];
  themes: MarketplaceTheme[];
}
