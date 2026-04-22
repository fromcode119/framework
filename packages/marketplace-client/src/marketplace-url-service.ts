import { MarketplaceClientConstants } from './marketplace-client-constants';

export class MarketplaceUrlService {
  static resolveCatalogUrl(url?: string): string {
    const raw = String(url || '').trim();
    if (!raw) {
      return MarketplaceClientConstants.DEFAULT_MARKETPLACE_CATALOG_URL;
    }

    if (!raw.startsWith('http')) {
      return raw;
    }

    const apiBaseUrl = MarketplaceUrlService.resolveApiBaseUrl(raw);
    if (apiBaseUrl.endsWith('.json')) {
      return apiBaseUrl;
    }

    return `${apiBaseUrl}/${MarketplaceClientConstants.CATALOG_FILENAME}`;
  }

  static resolveApiBaseUrl(url?: string): string {
    const raw = String(url || '').trim();
    if (!raw) {
      return MarketplaceClientConstants.DEFAULT_MARKETPLACE_API_URL;
    }

    if (!raw.startsWith('http')) {
      return raw;
    }

    const normalizedUrl = raw.replace(/\/$/, '');
    if (normalizedUrl.endsWith(`/${MarketplaceClientConstants.CATALOG_FILENAME}`)) {
      return normalizedUrl.replace(new RegExp(`/${MarketplaceClientConstants.CATALOG_FILENAME}$`), '');
    }

    if (MarketplaceUrlService.hasMarketplaceApiPath(normalizedUrl)) {
      return normalizedUrl;
    }

    return `${normalizedUrl}${MarketplaceClientConstants.API_BASE_PATH}`;
  }

  static resolvePublicBaseUrl(url?: string): string {
    const apiBaseUrl = MarketplaceUrlService.resolveApiBaseUrl(url);
    if (!apiBaseUrl.startsWith('http')) {
      return apiBaseUrl;
    }

    const parsedUrl = new URL(apiBaseUrl);
    const marketplaceApiSuffix = MarketplaceUrlService.getMarketplaceApiSuffixPattern();
    parsedUrl.pathname = parsedUrl.pathname.replace(marketplaceApiSuffix, '') || '/';
    return parsedUrl.toString().replace(/\/$/, '');
  }

  private static hasMarketplaceApiPath(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.pathname.endsWith(MarketplaceClientConstants.MARKETPLACE_ROUTE_PATH);
    } catch {
      return false;
    }
  }

  private static getMarketplaceApiSuffixPattern(): RegExp {
    const versionedApiPrefix = MarketplaceClientConstants.API_BASE_PATH.slice(
      0,
      MarketplaceClientConstants.API_BASE_PATH.length - MarketplaceClientConstants.MARKETPLACE_ROUTE_PATH.length,
    ).replace(/\/$/, '');
    const apiRoot = versionedApiPrefix.replace(/\/[A-Za-z0-9_-]+$/, '').replace(/\//g, '\\/');
    const marketplaceRoute = MarketplaceClientConstants.MARKETPLACE_ROUTE_PATH.replace(/\//g, '\\/');
    return new RegExp(`${apiRoot}\/[A-Za-z0-9_-]+${marketplaceRoute}$`);
  }
}