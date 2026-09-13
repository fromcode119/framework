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
}
