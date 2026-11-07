import { SystemConstants, ApiVersionUtils, CookieConstants } from '@fromcode119/core/client';
import { ApplicationUrlUtils } from '@fromcode119/core/client';
import { cookies, headers } from 'next/headers';
import { ServerFetchOutcome } from '@/lib/server-fetch-outcome';

/**
 * Where the storefront server sends a request: the API base URLs it may use, in order, and the paths
 * for system, collection and plugin endpoints.
 *
 * Split out of ServerApiUtils (431 lines) 2026-09-09.
 */
export class ServerApiPaths {

  static buildInternalApiBaseUrl(): string {
    return String(
      ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP) || ServerApiPaths.buildFrontendApiBaseUrl(),
    )
      .trim()
      .replace(/\/+$/, '');
  }


  static buildSystemResolvePath(query: URLSearchParams | string): string {
    const queryString = typeof query === 'string' ? query : query.toString();
    return `${SystemConstants.API_PATH.SYSTEM.RESOLVE}?${queryString}`;
  }


  static buildSystemFrontendPath(): string {
    return SystemConstants.API_PATH.SYSTEM.FRONTEND;
  }


  /** The same `/system/i18n?locale=…` the browser provider loads, so a server render resolves keys identically. */
  static buildSystemI18nPath(locale: string): string {
    const encoded = encodeURIComponent(String(locale || '').trim() || 'en');
    return `${SystemConstants.API_PATH.SYSTEM.I18N}?locale=${encoded}`;
  }


  static buildCollectionLookupPath(
    collectionSlug: string,
    options: { id?: string; limit?: number } = {}
  ): string {
    const slug = encodeURIComponent(String(collectionSlug || '').trim());
    const query = new URLSearchParams();
    if (options.id) query.set('id', String(options.id));
    query.set('limit', String(options.limit ?? 1));
    return `${SystemConstants.API_PATH.COLLECTIONS.BASE}/${slug}?${query.toString()}`;
  }


  static buildPluginPath(pluginSlug: string, path = '', query?: URLSearchParams | string): string {
    const plugin = String(pluginSlug || '').trim().replace(/^\/+|\/+$/g, '');
    const suffix = String(path || '').trim();
    const normalizedSuffix = suffix ? `/${suffix.replace(/^\/+/, '')}` : '';
    const queryString = query ? (typeof query === 'string' ? query : query.toString()) : '';
    const fullPath = `${SystemConstants.API_PATH.PLUGINS.BASE}/${encodeURIComponent(plugin)}${normalizedSuffix}`;
    return queryString ? `${fullPath}?${queryString}` : fullPath;
  }


  /**
   * The API bases a SERVER render may fetch through, in priority order.
   *
   * Only deployment-internal addresses: `INTERNAL_API_URL` when the deployment names one, otherwise the
   * container service and loopback candidates. Never a public domain — a domain is set in the admin,
   * not here, and in a container the public hostname may not even resolve (measured: 8s of `EAI_AGAIN`
   * per attempt, then a saturated resolver that took the healthy base down with it).
   */
  static getServerApiPrefixes(): string[] {
    const bases = ServerApiPaths.normalizeApiBases([ApplicationUrlUtils.readAppInternalBaseUrlFromEnvironment(ApplicationUrlUtils.API_APP)]);

    if (bases.length === 0) {
      for (const fallback of ApplicationUrlUtils.getServerApiBaseUrlCandidates()) {
        if (!bases.includes(fallback)) bases.push(fallback);
      }
    }

    return ServerApiPaths.unique(bases).map((base) => `${base}${ApiVersionUtils.prefix()}`);
  }


  static normalizeApiBases(values: Array<string | undefined>): string[] {
    return values
      .map((value) => ApplicationUrlUtils.normalizeBaseUrlCandidate(value, { stripApiPath: true }))
      .filter(Boolean)
      .map(ServerApiPaths.trimTrailingSlash);
  }


  static buildFrontendApiBaseUrl(): string {
    const prefixes = ServerApiPaths.getServerApiPrefixes();
    if (!prefixes.length) return ApplicationUrlUtils.LOCALHOST_PRIMARY_API_BASE_URL;
    return prefixes[0].replace(ApiVersionUtils.prefix(), '');
  }


  /**
   * The PUBLIC base for things a BROWSER will fetch — the theme bundle, `@font-face src:url(...)`,
   * resized images. It is baked into server-rendered HTML, so it must be an address the visitor can
   * reach, and EMPTY (a relative path) when there is none.
   *
   * Always EMPTY — a relative path. A domain is never deployment configuration, and the visitor's own
   * host is the right origin on every site of a multi-site platform. `ApiPathUtils.joinApiPath` turns an
   * empty base into a leading-slash RELATIVE path, which the visitor's own host serves — the gateway
   * routes `/api/*` on any app host to the api, and the app's own `/api` proxy covers a deployment
   * with no gateway. Same-origin is also what the browser already does for its api calls.
   */
  static buildPublicApiBaseUrl(): string {
    return '';
  }


  static trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
  }


  static unique(values: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      if (!value || seen.has(value)) continue;
      seen.add(value);
      output.push(value);
    }
    return output;
  }
}
