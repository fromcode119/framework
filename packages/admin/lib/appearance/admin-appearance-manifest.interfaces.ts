/**
 * Descriptor for one selectable admin appearance — the built-in default, or an additional appearance that
 * ships in admin-appearances/<slug>/. The presentation bundle is resolved separately; this is only the
 * descriptor used for registration and selection.
 */
export interface AdminAppearanceManifest {
  /** Stable unique id, e.g. 'default' or 'simple'. Matches admin-appearances/<id>/ for additional appearances. */
  readonly id: string;
  /** Human-readable label shown in admin appearance pickers. */
  readonly label: string;
  /** Optional one-line description. */
  readonly description?: string;
  /**
   * Optional allowlist of the admin surfaces this appearance exposes. When PRESENT, the appearance is a
   * curated workspace: only the listed plugin areas / path prefixes are reachable while it is active, and
   * any other admin route is blocked (default-deny containment — NOT an authorization change; role/permission
   * gates still apply server-side). When ABSENT, the appearance exposes every route (legacy passthrough).
   * A newly scaffolded appearance should ship an empty allowlist (`{ plugins: [], paths: [] }`) so it starts
   * exposing nothing until the author opts in.
   */
  readonly surfaces?: AppearanceSurfaces;
}

/** The set of admin surfaces an appearance exposes. See `AdminAppearanceManifest.surfaces`. */
export interface AppearanceSurfaces {
  /** Plugin slugs whose `/<slug>/*` admin routes this appearance exposes (matched on the first path segment). */
  readonly plugins?: readonly string[];
  /** Framework path prefixes this appearance exposes (e.g. '/my', '/settings/integrations', '/media'). */
  readonly paths?: readonly string[];
}
