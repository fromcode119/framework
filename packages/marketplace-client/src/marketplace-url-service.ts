import { MarketplaceClientConstants } from '@marketplace-client/constants/marketplace-client.constants';

/**
 * Turns the marketplace address an operator typed into the addresses this installation requests.
 *
 * The address may carry a QUERY (`https://market.example?key=…`). A marketplace that admits only
 * the installations it knows identifies them by it, so the query belongs to the address, not to
 * one request: it is carried on the catalogue request and on every download from the same host.
 * The path arithmetic below works on the address WITHOUT it — appending a path after a query would
 * put the path inside the query value.
 */
export class MarketplaceUrlService {
  static resolveCatalogUrl(url?: string): string {
    const raw = String(url || '').trim();
    // Blank stays blank: there is no built-in marketplace, only the one an operator names.
    if (!raw) {
      return '';
    }

    if (!raw.startsWith('http')) {
      return raw;
    }

    const apiBaseUrl = MarketplaceUrlService.resolveApiBaseUrl(raw);
    const query = MarketplaceUrlService.readQuery(raw);
    if (apiBaseUrl.endsWith('.json')) {
      return `${apiBaseUrl}${query}`;
    }

    return `${apiBaseUrl}/${MarketplaceClientConstants.CATALOG_FILENAME}${query}`;
  }

  /**
   * The query of a marketplace address (`?key=…`), or `''` when it has none or is not an http(s) URL.
   */
  static readQuery(url?: string): string {
    const parsed = MarketplaceUrlService.parse(url);
    return parsed && parsed.search.length > 1 ? parsed.search : '';
  }

  /**
   * Carry the marketplace address's query onto a download address — ONLY when the download is on the
   * marketplace's own host. A catalogue entry may point at a package elsewhere, and the query is the
   * marketplace's credential: handing it to another host would give it away. Parameters the download
   * address already names are kept as they are.
   */
  static withMarketplaceQuery(downloadUrl: string, marketplaceUrl?: string): string {
    const target = MarketplaceUrlService.parse(downloadUrl);
    const source = MarketplaceUrlService.parse(marketplaceUrl);
    if (!target || !source || target.origin !== source.origin) {
      return downloadUrl;
    }

    let changed = false;
    source.searchParams.forEach((value, name) => {
      if (target.searchParams.has(name)) return;
      target.searchParams.append(name, value);
      changed = true;
    });
    return changed ? target.toString() : downloadUrl;
  }

  /**
   * The address with every query VALUE masked, for logs. Log lines outlive the request and are read by
   * people who were never meant to hold a marketplace key.
   */
  static redact(url?: string): string {
    const raw = String(url || '');
    const parsed = MarketplaceUrlService.parse(raw);
    if (!parsed || parsed.search.length <= 1) {
      return raw;
    }

    const names = Array.from(new Set(Array.from(parsed.searchParams.keys())));
    parsed.search = names.map((name) => `${encodeURIComponent(name)}=***`).join('&');
    return parsed.toString();
  }

  static resolveApiBaseUrl(url?: string): string {
    const raw = MarketplaceUrlService.stripQuery(String(url || '').trim());
    if (!raw) {
      return '';
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

  private static stripQuery(url: string): string {
    if (!url.startsWith('http')) {
      return url;
    }

    const parsed = MarketplaceUrlService.parse(url);
    if (!parsed) {
      return url;
    }

    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  }

  private static parse(url?: string): URL | null {
    const raw = String(url || '').trim();
    if (!raw.startsWith('http')) {
      return null;
    }

    try {
      return new URL(raw);
    } catch {
      return null;
    }
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