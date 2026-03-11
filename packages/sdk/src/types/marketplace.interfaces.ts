import type { ScreenshotEntry } from './marketplace.types';

export interface Screenshot {
  url: string;
  caption?: string;
}

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
  rating?: {
    average: number;
    count: number;
  };
}

/**
 * PluginEntry is used as a frontend representation of a Marketplace plugin.
 * It is compatible with MarketplacePlugin but can be extended if needed.
 */
export interface PluginEntry extends MarketplacePlugin {}

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
  changelog?: { version: string; date: string; changes: string[] }[];
}

export interface MarketplaceData {
  version?: string;
  lastUpdated?: string;
  core?: {
    version: string;
    downloadUrl: string;
    lastUpdated: string;
  };
  plugins: MarketplacePlugin[];
  themes: MarketplaceTheme[];
}
