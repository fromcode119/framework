/**
 * Where each area of the API is MOUNTED, plus the admin, account and SCIM slugs.
 *
 * Split from `RouteConstants`, which was 416 lines of one flat map. The map already carried section
 * banners, so the seams were drawn by whoever wrote it; this just makes them files. Reached as
 * `RouteConstants.SEGMENTS.*` exactly as before — the literal moves, the name does not.
 *
 * `as const` on each half is load-bearing: the spread that recombines them keeps literal types only
 * if the parts have them, and several route helpers are typed against those literals.
 */
export class RouteMountSegments {
  static readonly ALL = {
  // ── Generic ──────────────────────────────────────────────────────────────
  ROOT: '/',

  // ── Top-level mount points ───────────────────────────────────────────────
  AUTH: '/auth',
  PLUGINS: '/plugins',
  MARKETPLACE: '/marketplace',
  THEMES: '/themes',
  APPEARANCES: '/appearances',
  /** Sources — the framework's own repository-tracking screen. */
  SOURCES: '/sources',
  /**
   * The Sources router's own sub-paths, RELATIVE to the mount above.
   *
   * Declared here because they were written twice — once as literals in the router and again as
   * literals in the admin's route service — with nothing tying the two together. A path typed at a
   * call site is a path that drifts from the router, and these had already drifted once.
   *
   * The server appends them to its mount; the admin composes them onto `API_PATH.SOURCES`.
   */
  SOURCES_PROVIDERS: '/providers',
  SOURCES_CHECK_UPDATES: '/check-updates',
  SOURCES_BRANCHES: '/branches',
  SOURCES_INSPECT: '/inspect',
  SOURCES_BUILD: '/build',
  SOURCES_PACKAGE: '/package',
  SOURCES_INSTALL: '/install',
  /** ONE source, by KIND and slug — a slug names an extension only within its kind. */
  SOURCES_ONE: '/:type/:slug',
  APPEARANCES_CATALOG: '/catalog',
  APPEARANCES_INSTALL: '/install',
  APPEARANCES_SLUG: '/:slug',
  SYSTEM: '/system',
  MEDIA: '/media',
  /** Private-file delivery: the recipient-facing token routes and the operator's share management. */
  FILES: '/files',
  VERSIONS: '/versions',

  /** Websocket upgrade path served by the API alongside the HTTP routes. */
  WEBSOCKET: '/socket',

  // ── Admin ───────────────────────────────────────────────────────────────
  ADMIN_BASE: '/admin',
  HEALTH: '/health',
  READY: '/ready',

  // ── Account (frontend page slugs) ────────────────────────────────────────
  ACCOUNT: '/account',
  ACCOUNT_SECTION: '/account/:section',
  /** Self-service GDPR endpoints on the auth router (authenticated, act on the CURRENT user). */
  ACCOUNT_EXPORT: '/account/export',
  ACCOUNT_DELETE: '/account/delete',

  // ── SCIM 2.0 provisioning ────────────────────────────────────────────────
  /** Standard SCIM base, mounted under the versioned API prefix and authenticated by bearer token. */
  SCIM_BASE: '/scim/v2',
  } as const;
}
