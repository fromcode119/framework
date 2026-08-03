import type { Screenshot } from '@core/screenshot';

export interface IMarketplaceTheme {
  slug: string;
  name: string;
  version: string;
  description: string;
  iconUrl?: string;
  screenshots?: Screenshot[];
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
