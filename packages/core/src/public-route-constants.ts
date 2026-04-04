import { SystemConstants } from './constants';

export class PublicRouteConstants {
  static readonly AUTH_SUFFIX = SystemConstants.API_PATH.AUTH.BASE;
  static readonly FRONTEND_SUFFIX = SystemConstants.API_PATH.SYSTEM.FRONTEND;
  static readonly I18N_SUFFIX = SystemConstants.API_PATH.SYSTEM.I18N;
  static readonly EVENTS_SUFFIX = SystemConstants.API_PATH.SYSTEM.EVENTS;
  static readonly HEALTH_SUFFIX = SystemConstants.API_PATH.SYSTEM.HEALTH;
  static readonly ACCOUNT_SELF_SERVICE_SUFFIXES = SystemConstants.API_PATH.AUTH.ACCOUNT_SELF_SERVICE;
  static readonly PLUGIN_ASSETS_PREFIX = SystemConstants.PUBLIC_ROUTE_PREFIXES.PLUGIN_ASSETS;
  static readonly THEME_ASSETS_PREFIX = SystemConstants.PUBLIC_ROUTE_PREFIXES.THEME_ASSETS;
}
