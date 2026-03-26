import { PublicRouteConstants } from '@fromcode119/core';
import { ApiConfig } from '../config/api-config';

export class PublicSystemRouteUtils {
  static readonly AUTH_SUFFIX = PublicRouteConstants.AUTH_SUFFIX;
  static readonly FRONTEND_SUFFIX = PublicRouteConstants.FRONTEND_SUFFIX;
  static readonly I18N_SUFFIX = PublicRouteConstants.I18N_SUFFIX;
  static readonly EVENTS_SUFFIX = PublicRouteConstants.EVENTS_SUFFIX;
  static readonly HEALTH_SUFFIX = PublicRouteConstants.HEALTH_SUFFIX;
  static readonly ACCOUNT_SELF_SERVICE_SUFFIXES = PublicRouteConstants.ACCOUNT_SELF_SERVICE_SUFFIXES;
  static readonly PLUGIN_ASSETS_PREFIX = PublicRouteConstants.PLUGIN_ASSETS_PREFIX;

  static isAuthPath(path: string): boolean {
    const prefixes = ApiConfig.getInstance().prefixes;
    return path.startsWith(`${prefixes.VERSIONED}${PublicSystemRouteUtils.AUTH_SUFFIX}`);
  }

  static isFrontendConfigPath(path: string): boolean {
    return path.endsWith(PublicSystemRouteUtils.FRONTEND_SUFFIX);
  }

  static isI18nPath(path: string): boolean {
    return path.includes(PublicSystemRouteUtils.I18N_SUFFIX);
  }

  static isEventsPath(path: string): boolean {
    return path.includes(PublicSystemRouteUtils.EVENTS_SUFFIX);
  }

  static isHealthPath(path: string): boolean {
    return path.includes(PublicSystemRouteUtils.HEALTH_SUFFIX);
  }

  static isRateLimitBypassPath(path: string): boolean {
    return (
      PublicSystemRouteUtils.isEventsPath(path) ||
      PublicSystemRouteUtils.isHealthPath(path) ||
      PublicSystemRouteUtils.isFrontendConfigPath(path) ||
      PublicSystemRouteUtils.isI18nPath(path) ||
      PublicSystemRouteUtils.isAccountSelfServicePath(path)
    );
  }

  static isMaintenanceBypassPath(path: string): boolean {
    const apiConfig = ApiConfig.getInstance();
    return (
      path === apiConfig.probeRoutes.HEALTH ||
      path === apiConfig.probeRoutes.READY ||
      path === apiConfig.routes.system.HEALTH ||
      path === apiConfig.routes.system.OPENAPI ||
      PublicSystemRouteUtils.isAuthPath(path) ||
      PublicSystemRouteUtils.isI18nPath(path) ||
      PublicSystemRouteUtils.isEventsPath(path) ||
      PublicSystemRouteUtils.isFrontendConfigPath(path) ||
      path.startsWith(PublicSystemRouteUtils.PLUGIN_ASSETS_PREFIX)
    );
  }

  static isAccountSelfServicePath(path: string): boolean {
    return PublicSystemRouteUtils.ACCOUNT_SELF_SERVICE_SUFFIXES.some((suffix) => path.endsWith(suffix));
  }
}
