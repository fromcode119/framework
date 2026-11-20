

import { IMarketplaceRating } from '@marketplace-client/interfaces/marketplace-rating.interface';
import type { Screenshot } from '@marketplace-client/screenshot';

export class MarketplacePlugin {
  declare slug: string;
  declare name: string;
  declare version: string;
  declare description: string;
  declare downloadUrl: string;
  declare artifactSha256?: string;
  declare category: string;
  declare author: string;
  declare homepage?: string;
  declare iconUrl?: string;
  declare capabilities?: string[];
  declare dependencies?: Record<string, string>;
  /** The platform this build needs (`manifest.engines`). `core` is a semver range; a too-old core refuses the install. */
  declare engines?: { core?: string };
  declare screenshots?: Screenshot[];
  declare changelog?: any[];
  declare isFeatured?: boolean;
  declare isTrending?: boolean;
  declare isVerified?: boolean;
  declare downloads?: number;
  declare rating?: IMarketplaceRating;
}
