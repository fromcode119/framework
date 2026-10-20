import { RouteConstants } from '@core/constants/route.constants';
import { SystemApiPaths } from '@core/constants/system-api-paths.constants';

export class PublicRouteConstants {
  static readonly AUTH_SUFFIX = SystemApiPaths.ALL.AUTH.BASE;
  static readonly FRONTEND_SUFFIX = SystemApiPaths.ALL.SYSTEM.FRONTEND;
  static readonly I18N_SUFFIX = SystemApiPaths.ALL.SYSTEM.I18N;
  static readonly EVENTS_SUFFIX = SystemApiPaths.ALL.SYSTEM.EVENTS;
  static readonly HEALTH_SUFFIX = SystemApiPaths.ALL.SYSTEM.HEALTH;
  /**
   * Where an operator's browser spends a preview grant. A PREFIX, because the token is part of the
   * path — and it is the one route that must answer on a site precisely while that site is closed.
   */
  static readonly SITE_PREVIEW_EXCHANGE_PREFIX = `${SystemApiPaths.ALL.SYSTEM.SITE_PREVIEW}/exchange/`;
  static readonly ACCOUNT_SELF_SERVICE_SUFFIXES = SystemApiPaths.ALL.AUTH.ACCOUNT_SELF_SERVICE;
  /** Route prefixes used for internal permission checks; also `SystemConstants.PUBLIC_ROUTE_PREFIXES`. */
  static readonly PLUGIN_ASSETS_PREFIX = `${RouteConstants.SEGMENTS.PLUGINS}/`;
  static readonly THEME_ASSETS_PREFIX = `${RouteConstants.SEGMENTS.THEMES}/`;
}
