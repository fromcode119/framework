import { SystemConstants } from '@core/constants/system.constants';

export class PublicRouteConstants {
  static readonly AUTH_SUFFIX = SystemConstants.API_PATH.AUTH.BASE;
  static readonly FRONTEND_SUFFIX = SystemConstants.API_PATH.SYSTEM.FRONTEND;
  static readonly I18N_SUFFIX = SystemConstants.API_PATH.SYSTEM.I18N;
  static readonly EVENTS_SUFFIX = SystemConstants.API_PATH.SYSTEM.EVENTS;
  static readonly HEALTH_SUFFIX = SystemConstants.API_PATH.SYSTEM.HEALTH;
  /**
   * Where an operator's browser spends a preview grant. A PREFIX, because the token is part of the
   * path — and it is the one route that must answer on a site precisely while that site is closed.
   */
  static readonly SITE_PREVIEW_EXCHANGE_PREFIX = `${SystemConstants.API_PATH.SYSTEM.SITE_PREVIEW}/exchange/`;
  static readonly ACCOUNT_SELF_SERVICE_SUFFIXES = SystemConstants.API_PATH.AUTH.ACCOUNT_SELF_SERVICE;
  static readonly PLUGIN_ASSETS_PREFIX = SystemConstants.PUBLIC_ROUTE_PREFIXES.PLUGIN_ASSETS;
  static readonly THEME_ASSETS_PREFIX = SystemConstants.PUBLIC_ROUTE_PREFIXES.THEME_ASSETS;
}
