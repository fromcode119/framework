// Deep imports, not core's `client` barrel: reachable from the middleware graph, like AdminConstants.
import { ApiPathUtils } from '@fromcode119/core/api/api-path-utils';
import { ApiVersionUtils } from '@fromcode119/core/api-version';

/** How the admin spells an api URL: versioned, legacy (unversioned) and with a query. Used by `AdminConstants`. */
export class AdminApiPaths {
  private static readonly PREFIX = ApiVersionUtils.prefix();

  static v(path: string): string {
    return `${AdminApiPaths.PREFIX}${path}`;
  }

  static legacy(path: string): string {
    return `${AdminApiPaths.rootApiPrefix()}${path}`;
  }

  private static rootApiPrefix(): string {
    return AdminApiPaths.PREFIX.replace(/\/v\d+$/, '');
  }

  static versionedRoute(basePath: string, segment: string, params?: Record<string, string | number>): string {
    return AdminApiPaths.v(ApiPathUtils.fillPath(`${basePath}${segment}`, params));
  }

  static withQuery(path: string, query: Record<string, string | number | boolean | undefined | null>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
  }
}
