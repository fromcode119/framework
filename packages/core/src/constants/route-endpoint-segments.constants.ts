/**
 * The endpoint segments under the plugin, collection, theme, media and file-delivery mounts.
 *
 * Split from `RouteConstants` along the section banners the flat map already carried. Reached as
 * `RouteConstants.SEGMENTS.*` exactly as before.
 */
export class RouteEndpointSegments {
  static readonly ALL = {
  // ── Plugins ──────────────────────────────────────────────────────────────
  PLUGINS_MARKETPLACE: '/marketplace',
  PLUGINS_INSTALL: '/install/:slug',
  PLUGINS_UPDATE_ALL: '/update-all',
  PLUGINS_INSTALL_OPERATION: '/install-operations/:operationId',
  PLUGINS_UPLOAD_SESSION: '/upload/session',
  PLUGINS_UPLOAD_CHUNK: '/upload/chunk',
  PLUGINS_UPLOAD_SESSION_INSPECT: '/upload/session/inspect',
  PLUGINS_UPLOAD_INSPECT: '/upload/inspect',
  PLUGINS_UPLOAD_COMPLETE: '/upload/complete',
  PLUGINS_UPLOAD: '/upload',
  PLUGINS_REAPPROVE_ALL: '/reapprove-all',
  PLUGINS_HEALTH: '/health',
  PLUGINS_SLUG_TOGGLE: '/:slug/toggle',
  PLUGINS_SLUG_CONFIG: '/:slug/config',
  PLUGINS_SLUG_SANDBOX: '/:slug/sandbox',
  PLUGINS_SLUG_LOAD_INSTALLED: '/:slug/load-installed',
  PLUGINS_SLUG_LOGS: '/:slug/logs',
  PLUGINS_SLUG_SETTINGS: '/:slug/settings',
  PLUGINS_SLUG_SETTINGS_SCHEMA: '/:slug/settings/schema',
  PLUGINS_SLUG_SETTINGS_RESET: '/:slug/settings/reset',
  PLUGINS_SLUG_SETTINGS_EXPORT: '/:slug/settings/export',
  PLUGINS_SLUG_SETTINGS_IMPORT: '/:slug/settings/import',
  PLUGINS_SLUG_UI_WILDCARD: '/:slug/ui/*assetPath',
  PLUGINS_SLUG: '/:slug',

  // ── Collections ──────────────────────────────────────────────────────────
  COLLECTIONS_SLUG: '/:slug',
  COLLECTIONS_SLUG_ID: '/:slug/:id',
  COLLECTIONS_SLUG_EXPORT: '/:slug/export',
  COLLECTIONS_SLUG_IMPORT: '/:slug/import',
  COLLECTIONS_SLUG_BULK: '/:slug/bulk',
  COLLECTIONS_SLUG_BULK_UPDATE: '/:slug/bulk-update',
  COLLECTIONS_SLUG_BULK_DELETE: '/:slug/bulk-delete',
  COLLECTIONS_SLUG_SUGGESTIONS_FIELD: '/:slug/suggestions/:field',
  COLLECTIONS_SLUG_ID_VERSION: '/:slug/:id/:version',
  COLLECTIONS_SLUG_ID_VERSION_RESTORE: '/:slug/:id/:version/restore',

  // ── Global Collections (prefixed with /collections) ──────────────────────
  GLOBAL_COLLECTIONS_SLUG: '/collections/:slug',
  GLOBAL_COLLECTIONS_SLUG_ID: '/collections/:slug/:id',
  GLOBAL_COLLECTIONS_SLUG_EXPORT: '/collections/:slug/export',
  GLOBAL_COLLECTIONS_SLUG_IMPORT: '/collections/:slug/import',
  GLOBAL_COLLECTIONS_SLUG_BULK: '/collections/:slug/bulk',
  GLOBAL_COLLECTIONS_SLUG_BULK_UPDATE: '/collections/:slug/bulk-update',
  GLOBAL_COLLECTIONS_SLUG_BULK_DELETE: '/collections/:slug/bulk-delete',
  GLOBAL_COLLECTIONS_SLUG_SUGGESTIONS_FIELD: '/collections/:slug/suggestions/:field',

  // ── Themes ──────────────────────────────────────────────────────────────
  THEMES_UPLOAD_SESSION: '/upload/session',
  THEMES_UPLOAD_CHUNK: '/upload/chunk',
  THEMES_UPLOAD_SESSION_INSPECT: '/upload/session/inspect',
  THEMES_UPLOAD_INSPECT: '/upload/inspect',
  THEMES_UPLOAD_COMPLETE: '/upload/complete',
  THEMES_UPLOAD: '/upload',
  /**
   * A SITE uploading its OWN theme, and removing one.
   *
   * A separate path from `/upload` on purpose. That one installs onto the shared container and is a
   * platform action; this one writes into the site's own directory, is gated on the site's admin
   * rather than on a platform admin, and refuses everything `TenantThemePackagePolicy` refuses. Two
   * different acts should not share a URL — a reader of the router has to be able to see which is
   * which without following the middleware.
   */
  THEMES_MINE_UPLOAD: '/mine/upload',
  THEMES_MINE_SLUG: '/mine/:slug',
  THEMES_SLUG_ACTIVATE: '/:slug/activate',
  THEMES_SLUG_DISABLE: '/:slug/disable',
  THEMES_SLUG_RESET: '/:slug/reset',
  THEMES_SLUG_INSTALL: '/:slug/install',
  THEMES_SLUG_CONFIG: '/:slug/config',
  THEMES_SLUG_CHECK_UPDATE: '/:slug/check-update',
  THEMES_SLUG_PUBLIC_WILDCARD: '/:slug/public/*assetPath',
  THEMES_SLUG_UI_WILDCARD: '/:slug/ui/*assetPath',
  THEMES_ACTIVE_ASSETS: '/active/assets',
  THEMES_SLUG: '/:slug',

  // ── Media ───────────────────────────────────────────────────────────────
  MEDIA_UPLOAD: '/upload',
  MEDIA_FOLDERS: '/folders',
  MEDIA_FOLDERS_ID: '/folders/:id',
  MEDIA_FOLDERS_ID_PATH: '/folders/:id/path',
  MEDIA_ID: '/:id',
  MEDIA_ID_OPTIMIZE: '/:id/optimize',
  MEDIA_ID_RAW: '/:id/raw',
  // MEDIA_BASE: '/' is implicitly handled by the router mount point or just ''

  // ── Private file delivery ───────────────────────────────────────────────
  // Literal paths FIRST in the router: `/:token` matches any single segment and would otherwise
  // swallow every one of these.
  FILES_SHARES: '/shares',
  FILES_SHARE_ID: '/shares/:shareId',
  FILES_SHARE_GRANTS: '/shares/:shareId/grants',
  FILES_GRANT_ID: '/grants/:grantId',
  /** Activity across EVERY share — the operator's view of what the log records. */
  FILES_ACTIVITY: '/activity',
  /** What actually happened to a share — opens, downloads and refusals from the access log. */
  FILES_SHARE_ACTIVITY: '/shares/:shareId/activity',
  /** Who can currently open one file — sharing is done FROM the file, so this is the question asked. */
  FILES_MEDIA_GRANTS: '/media/:mediaId/grants',
  FILES_MY_SHARES: '/my/shares',
  FILES_MY_DOWNLOAD: '/my/shares/:shareId/download/:mediaId',
  FILES_TOKEN: '/:token',
  FILES_TOKEN_DOWNLOAD: '/:token/download/:mediaId',
  } as const;
}
