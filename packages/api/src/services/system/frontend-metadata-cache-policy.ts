/**
 * The Cache-Control for `/system/frontend` — the site's theme, menu, plugin set and public settings.
 *
 * Only a STOREFRONT request may share it. There the site is chosen by the Host, which is part of every
 * cache key, so one URL always means one site. In the console the site is chosen by the SESSION, and the
 * URL is the same for every site: with `public, max-age=30, stale-while-revalidate=300`, switching site
 * kept serving the previous site's payload for up to five and a half minutes — the console loaded the
 * other site's theme and offered its blocks while editing this one. Those requests revalidate every
 * time instead (`no-cache` still allows a cheap 304 against the ETag) and stay out of shared caches.
 */
export class FrontendMetadataCachePolicy {
  static readonly STOREFRONT_SURFACE = 'storefront';

  static readonly SHARED = 'public, max-age=30, stale-while-revalidate=300';
  static readonly PER_SESSION = 'private, no-cache';
  static readonly NEVER = 'no-store';

  /**
   * @param surface how the request was bound to its site (`req.tenantSurface`), or undefined when no
   *                site is bound — then the answer does not depend on the caller and may be shared.
   * @param closedSite a site that is not published: its answer changes the moment somebody publishes.
   */
  static resolve(surface: string | undefined, closedSite: boolean): string {
    if (closedSite) return FrontendMetadataCachePolicy.NEVER;
    if (surface && surface !== FrontendMetadataCachePolicy.STOREFRONT_SURFACE) return FrontendMetadataCachePolicy.PER_SESSION;
    return FrontendMetadataCachePolicy.SHARED;
  }
}
