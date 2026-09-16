export interface IMenuItemManifest {
  label: string;
  path: string;
  icon?: string;
  priority?: number;
  group?: string;
  children?: IMenuItemManifest[];
  /** Shown to PLATFORM admins only; dropped from the payload for everyone else on a multi-tenant deployment. */
  platformOnly?: boolean;
  /**
   * Needs a SITE to mean anything; dropped from the payload while no site is selected.
   *
   * The mirror of `platformOnly`, and it exists for a harder reason than tidiness. With no tenant
   * bound, every tenant-scoped table answers zero rows — so an unfiltered item leads to a page that
   * renders an empty list and says nothing about why. A screen that shows nothing without stating
   * that it has nothing to show is the failure this platform is not allowed to have.
   *
   * It is a FACT about where an item's data lives, not a preference: plugin tables are tenant-scoped,
   * so a plugin's own screens are site-scoped whether or not anyone declares it.
   */
  siteOnly?: boolean;
  /**
   * Belongs to the PLATFORM and means nothing inside a site; dropped from the payload while one is
   * selected.
   *
   * The true mirror of {@link siteOnly}, and a different axis from {@link platformOnly}. That one is
   * about WHO is asking — a tenant's own administrator never sees these. This is about WHERE the
   * operator is STANDING: a platform administrator who has stepped into a site was still handed the
   * platform's own screens, so the console showed that site's people and media beside the registry of
   * every site and every repository this installation builds. Switching into a site is supposed to
   * mean the console is that site's.
   *
   * Like `siteOnly`, a FACT about where the item's data lives rather than a preference. These screens
   * have no tenant column at all, so standing in a site changes nothing about what they would show —
   * which is exactly why showing them there mixes the two worlds instead of scoping anything.
   */
  platformScopeOnly?: boolean;
}
