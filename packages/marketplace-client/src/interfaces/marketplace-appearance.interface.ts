
import type { Screenshot } from '@marketplace-client/screenshot';

export interface IMarketplaceAppearance {
  slug: string;
  name: string;
  version: string;
  description: string;
  screenshots?: Screenshot[];
  author: string;
  downloadUrl?: string;
  previewUrl?: string;
  isFeatured?: boolean;
  downloads?: number;
}
