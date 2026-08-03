/** The set of admin surfaces an appearance exposes. See `AdminAppearanceManifest.surfaces`. */
export interface IAppearanceSurfaces {
  /** Plugin slugs whose `/<slug>/*` admin routes this appearance exposes (matched on the first path segment). */
  readonly plugins?: readonly string[];
  /** Framework path prefixes this appearance exposes (e.g. '/my', '/settings/integrations', '/media'). */
  readonly paths?: readonly string[];
}
