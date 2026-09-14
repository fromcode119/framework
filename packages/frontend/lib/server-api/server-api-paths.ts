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
      process.env.INTERNAL_API_URL || process.env.API_URL || ServerApiPaths.buildFrontendApiBaseUrl(),
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
   * `NEXT_PUBLIC_API_URL` is deliberately absent while any server-side base is configured. It is
   * the BROWSER-facing URL: in a container deployment that public hostname does not resolve from
   * inside the frontend container at all. Including it made every fallback attempt stall the full
   * DNS timeout (measured: 8s of `EAI_AGAIN` per attempt) and — far worse — saturate the container
   * resolver, after which the healthy server-side base ALSO failed to resolve. That cascade is what
   * turned published pages into intermittent hard 404s. It stays as a last resort only when nothing
   * server-side is configured, so an initial setup that only sets the public URL still works.
   */
  static getServerApiPrefixes(): string[] {
    const bases = ServerApiPaths.normalizeApiBases([
      process.env.INTERNAL_API_URL,
      process.env.API_URL,
    ]);

    if (bases.length === 0) {
      bases.push(...ServerApiPaths.normalizeApiBases([process.env.NEXT_PUBLIC_API_URL]));
    }

    // Only add localhost fallbacks when NO primary URL is configured
    // (avoids useless connection attempts in Docker where localhost != API)
    // real API base is configured (prevents silent failures during initial setup).
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
      .filter((value) => !ServerApiPaths.isLikelyFrontendBase(value))
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
   * It previously read `API_URL` too and fell back to a localhost base. Both are addresses of this
   * SERVER, not of the visitor's browser: in a container `API_URL` is `http://api:3000`, so a
   * deployment that set no public URL emitted `http://api:3000/api/v1/themes/<t>/ui/bundle.js` and
   * `src:url(http://api:3000/.../font.woff)` into the page — a theme that cannot load and fonts that
   * cannot resolve, with nothing in the server log to say so. The localhost fallback was the same
   * mistake with a friendlier hostname, and an invented value besides.
   *
   * Empty is the correct answer when nothing public is configured: `ApiPathUtils.joinApiPath` turns an
   * empty base into a leading-slash RELATIVE path, which the visitor's own host serves — the gateway
   * routes `/api/*` on any app host to the api, and the app's own `/api` proxy covers a deployment
   * with no gateway. Same-origin is also what the browser already does for its api calls.
   */
  static buildPublicApiBaseUrl(): string {
    return ApplicationUrlUtils.readEnvironmentBaseUrl(['NEXT_PUBLIC_API_URL'], { stripApiPath: true });
  }


  static trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
  }


  static isLikelyFrontendBase(value: string): boolean {
    try {
      const candidate = new URL(ApplicationUrlUtils.normalizeBaseUrlCandidate(value)).origin.toLowerCase();
      const configuredFrontendOrigins = [
        process.env.FRONTEND_URL,
      ]
        .map((origin) => ApplicationUrlUtils.normalizeBaseUrlCandidate(origin))
        .filter(Boolean)
        .map((origin) => {
          try { return new URL(origin).origin.toLowerCase(); } catch { return ''; }
        })
        .filter(Boolean);
      return configuredFrontendOrigins.includes(candidate);
    } catch {
      return false;
    }
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
