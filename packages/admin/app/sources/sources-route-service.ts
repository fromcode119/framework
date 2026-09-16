import { AdminConstants } from '@/lib/constants/admin.constants';

/**
 * The Sources endpoints.
 *
 * Composed from `AdminConstants.ENDPOINTS.SOURCES`, which resolves to the same segments the router
 * mounts. It used to hold its own string literals — so every path existed twice, here and in the
 * router, with nothing tying the two together. A path typed at a call site is a path that drifts
 * from the router, and these had already drifted once: they were `/sources/...` beneath a plugin's
 * own namespace, and mounted as framework routes that would have read `/sources/sources`.
 */
export class SourcesRouteService {
  private static readonly ENDPOINTS = AdminConstants.ENDPOINTS.SOURCES;

  static providers(): string { return SourcesRouteService.ENDPOINTS.PROVIDERS; }
  static list(): string { return SourcesRouteService.ENDPOINTS.BASE; }
  static create(): string { return SourcesRouteService.ENDPOINTS.BASE; }

  /**
   * ONE source, addressed by its kind AND its slug.
   *
   * Both, because a slug names an extension only within its kind: a plugin, a theme and an
   * appearance may all be called the same thing. Addressed by slug alone, Delete and Build acted on
   * whichever row came back first.
   */
  static one(type: string, slug: string): string {
    return `${SourcesRouteService.ENDPOINTS.BASE}/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`;
  }

  static buildAll(): string { return SourcesRouteService.ENDPOINTS.BUILD_ALL; }
  static buildOne(type: string, slug: string): string {
    return `${SourcesRouteService.one(type, slug)}${SourcesRouteService.ENDPOINTS.BUILD_SUFFIX}`;
  }
  static checkUpdates(): string { return SourcesRouteService.ENDPOINTS.CHECK_UPDATES; }
  static branches(): string { return SourcesRouteService.ENDPOINTS.BRANCHES; }
  static inspect(): string { return SourcesRouteService.ENDPOINTS.INSPECT; }

  /** What is installed, what was last built, and every version still staged. */
  static versions(type: string, slug: string): string {
    return `${SourcesRouteService.one(type, slug)}${SourcesRouteService.ENDPOINTS.VERSIONS_SUFFIX}`;
  }

  /** Puts one of those staged versions in place. */
  static install(type: string, slug: string): string {
    return `${SourcesRouteService.one(type, slug)}${SourcesRouteService.ENDPOINTS.INSTALL_SUFFIX}`;
  }

  /** The built package as a downloadable archive, zipped on request. */
  static packageArchive(type: string, slug: string): string {
    return `${SourcesRouteService.one(type, slug)}${SourcesRouteService.ENDPOINTS.PACKAGE_SUFFIX}`;
  }
}
