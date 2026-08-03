import { IMarketplaceChangelogEntry } from '@marketplace-client/interfaces/marketplace-changelog-entry.interface';
import type { Screenshot } from '@marketplace-client/screenshot';

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
  changelog?: IMarketplaceChangelogEntry[];
}
