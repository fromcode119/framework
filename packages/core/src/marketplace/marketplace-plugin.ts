import type { Screenshot } from '@core/screenshot';

export class MarketplacePlugin {
  declare slug: string;
  declare name: string;
  declare version: string;
  declare description: string;
  declare downloadUrl: string;
  declare category: string;
  declare author: string;
  declare homepage?: string;
  declare iconUrl?: string;
  /** Lucide icon NAME (e.g. 'ShoppingBag') rendered from the locally-bundled set when no iconUrl image is declared. */
  declare icon?: string;
  /**
   * WHERE this entry came from: `remote` is the configured catalogue, `local` is a package this
   * installation built itself through Sources. The two are merged into one list and look identical
   * once rendered, so without this the screen headed "Marketplace" offers locally-built packages to
   * an operator connected to no marketplace at all, with nothing saying so.
   */
  declare source?: string;
  declare capabilities?: string[];
  declare dependencies?: Record<string, string>;
  declare screenshots?: Screenshot[];
  declare changelog?: any[];
  declare isFeatured?: boolean;
  declare isTrending?: boolean;
  declare isVerified?: boolean;
  declare downloads?: number;
  declare rating?: {
    average: number;
    count: number;
  };
}
