import { PublicRouteConstants } from '@fromcode119/core';
import { ApiConfig } from '@api/config/api-config';

export class PublicSystemRouteUtils {
  static readonly AUTH_SUFFIX = PublicRouteConstants.AUTH_SUFFIX;
  static readonly FRONTEND_SUFFIX = PublicRouteConstants.FRONTEND_SUFFIX;
  static readonly I18N_SUFFIX = PublicRouteConstants.I18N_SUFFIX;
  static readonly EVENTS_SUFFIX = PublicRouteConstants.EVENTS_SUFFIX;
  static readonly HEALTH_SUFFIX = PublicRouteConstants.HEALTH_SUFFIX;
  static readonly ACCOUNT_SELF_SERVICE_SUFFIXES = PublicRouteConstants.ACCOUNT_SELF_SERVICE_SUFFIXES;
  static readonly PLUGIN_ASSETS_PREFIX = PublicRouteConstants.PLUGIN_ASSETS_PREFIX;
  static readonly THEME_ASSETS_PREFIX = PublicRouteConstants.THEME_ASSETS_PREFIX;
  static readonly PLUGIN_UI_ASSET_RE = /(?:^|\/)plugins\/[^/]+\/ui\//;
  static readonly THEME_UI_ASSET_RE = /(?:^|\/)themes\/[^/]+\/ui\//;

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

  static isPluginAssetPath(path: string): boolean {
    return PublicSystemRouteUtils.PLUGIN_UI_ASSET_RE.test(path);
  }

  static isThemeAssetPath(path: string): boolean {
    return PublicSystemRouteUtils.THEME_UI_ASSET_RE.test(path);
  }

  static isUiAssetPath(path: string): boolean {
    return PublicSystemRouteUtils.isPluginAssetPath(path) || PublicSystemRouteUtils.isThemeAssetPath(path);
  }

  static isRateLimitBypassPath(path: string): boolean {
    return (
      PublicSystemRouteUtils.isEventsPath(path) ||
      PublicSystemRouteUtils.isHealthPath(path) ||
      PublicSystemRouteUtils.isFrontendConfigPath(path) ||
      PublicSystemRouteUtils.isI18nPath(path) ||
      PublicSystemRouteUtils.isAccountSelfServicePath(path) ||
      PublicSystemRouteUtils.isUiAssetPath(path)
    );
  }

  static isMaintenanceBypassPath(path: string): boolean {
    const apiConfig = ApiConfig.getInstance();
    return (
      path === apiConfig.probeRoutes.HEALTH ||
      path === apiConfig.probeRoutes.READY ||
      path === apiConfig.routes.system.HEALTH ||
      path === apiConfig.routes.system.OPENAPI ||
      path === apiConfig.routes.system.DOCS ||
      PublicSystemRouteUtils.isAuthPath(path) ||
      PublicSystemRouteUtils.isI18nPath(path) ||
      PublicSystemRouteUtils.isEventsPath(path) ||
      PublicSystemRouteUtils.isFrontendConfigPath(path) ||
      PublicSystemRouteUtils.isUiAssetPath(path)
    );
  }

  /**
   * The routes a browser must still reach when admin tenancy has REFUSED its session — the login
   * screen's own bootstrap. Health (is the API there), i18n (what language to speak) and the frontend
   * config (brand tokens) are asked before anyone is signed in, and on a workspace domain an account
   * without a membership was answered `tenant_access_revoked` for all three: the console then sat on
   * "Initializing Secure Session" forever, in English, with no way to reach its own login.
   *
   * They continue with NO tenant bound, so every tenant-scoped query behind them is fail-closed and
   * returns nothing — which is why the loose `includes` matching these predicates use is safe HERE
   * even though it would not be as a general exemption: the worst a stray match can do is answer a
   * refused session with no rows.
   */
  static isTenancyOptionalPath(path: string): boolean {
    return (
      PublicSystemRouteUtils.isHealthPath(path) ||
      PublicSystemRouteUtils.isI18nPath(path) ||
      PublicSystemRouteUtils.isFrontendConfigPath(path) ||
      PublicSystemRouteUtils.isUiAssetPath(path)
    );
  }

  static isAccountSelfServicePath(path: string): boolean {
    return PublicSystemRouteUtils.ACCOUNT_SELF_SERVICE_SUFFIXES.some((suffix) => path.endsWith(suffix));
  }
}
