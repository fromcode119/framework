/**
 * The Sources endpoints, relative to the api's `/sources` mount.
 *
 * One place, because a path typed at a call site is a path that drifts from the router. These were
 * `/sources/...` when this screen belonged to a plugin and the plugin owned its own namespace;
 * mounted as framework routes that would have read `/sources/sources`.
 */
export class SourcesRouteService {
  static providers(): string { return '/sources/providers'; }
  static list(): string { return '/sources'; }
  static create(): string { return '/sources'; }
  /**
   * ONE source, addressed by its kind AND its slug.
   *
   * Both, because a slug names an extension only within its kind: a plugin, a theme and an
   * appearance may all be called `tagiqx`. Addressed by slug alone, Delete and Build acted on
   * whichever row came back first.
   */
  static one(type: string, slug: string): string {
    return `/sources/${encodeURIComponent(type)}/${encodeURIComponent(slug)}`;
  }
  static buildAll(): string { return '/sources/build'; }
  static buildOne(type: string, slug: string): string { return `${SourcesRouteService.one(type, slug)}/build`; }
  static checkUpdates(): string { return '/sources/check-updates'; }
  static branches(): string { return '/sources/branches'; }
  static inspect(): string { return '/sources/inspect'; }
  /** The built package as a downloadable archive, zipped on request. */
  static packageArchive(type: string, slug: string): string {
    return `${SourcesRouteService.one(type, slug)}/package`;
  }
}
