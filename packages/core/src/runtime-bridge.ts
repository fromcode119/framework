import { ApplicationUrlUtils } from '@core/utils/application-url-utils';
import { SystemConstants } from '@core/constants/system.constants';
import { RuntimeConstants } from '@core/constants/runtime.constants';
import type { IFrontendRuntimeMetadata } from '@core/interfaces/frontend-runtime-metadata.interface';
import { EnvUtils } from '@core/utils/env-utils';

/**
 * Utilities for accessing the Fromcode framework's shared browser runtime.
 */
export class RuntimeBridge {
  /**
   * Where this process should call the api.
   *
   * IN THE BROWSER IT IS ALWAYS THE PAGE'S OWN ORIGIN, and that is not a preference — a different
   * origin is a different SESSION. The cookie naming the site you are on is host-scoped, so a console
   * served from `admin.example` that calls `api.example` sends a different (wider) cookie and gets a
   * different answer. Measured on the console: `/auth/tenants/available` replied `current: "initech"`
   * same-origin and `current: null` from the api host, both 200, so the header displayed
   * "Platform / No site" while every write stayed bound to the site. Nothing errored; the scope was
   * just quietly wrong.
   *
   * The browser chain this replaces could only ever land on the other origin. The bridge value, the
   * env value and `inferBrowserBaseUrl` were each passed through `normalizeApiBaseUrlCandidate`,
   * which REWRITES an `admin.*`/`frontend.*` host to `api.*` — so even handing it `location.origin`
   * came back as the api host. (`NEXT_PUBLIC_API_URL` never reached the bundle anyway: it is read
   * through a dynamic key, which Next cannot inline.) Host-role swapping is the bug, so none of it
   * survives here.
   *
   * The gateway routes `/api/*`, the uploads tree and extension assets on ANY app host to the api
   * with the Host intact, which is what makes same-origin correct rather than merely convenient — it
   * is also how the storefront has worked since the equivalent fix there.
   *
   * SERVER-side is unchanged: SSR and the `/api` proxy still resolve `NEXT_PUBLIC_API_URL`/`API_URL`
   * (and the proxy prefers `INTERNAL_API_URL`), because a server has no origin to speak of.
   */
  static resolveApiBaseUrl(options: { fallbackHost?: string } = {}): string {
    const fallbackBaseUrl = RuntimeBridge.normalizeApiBaseUrlCandidate(options.fallbackHost);

    if (EnvUtils.isServer()) {
      return RuntimeBridge.normalizeApiBaseUrlCandidate(
        ApplicationUrlUtils.readEnvironmentBaseUrl(['NEXT_PUBLIC_API_URL', 'API_URL'], { stripApiPath: true }),
      )
        || fallbackBaseUrl;
    }

    return ApplicationUrlUtils.normalizeBaseUrlCandidate((window as any)?.location?.origin || '')
      || fallbackBaseUrl;
  }

  /**
   * Resolves the framework's internal bridge for a specific runtime module.
   * Used by plugins to communicate with the shared singleton state.
   */
  static getBridge<T = any>(moduleName: string = '@fromcode119/react'): T {
    if (EnvUtils.isServer()) return {} as T;
    const win = window as any;
    const modules = win[RuntimeConstants.GLOBALS.MODULES];
    return (modules?.[moduleName]) || win[RuntimeConstants.GLOBALS.FROMCODE] || {};
  }

  static async getMetadata(options: { ensureLoaded?: boolean } = {}): Promise<IFrontendRuntimeMetadata> {
    const ensureLoaded = options.ensureLoaded !== false;

    const read = (): IFrontendRuntimeMetadata => {
      const bridge = RuntimeBridge.getBridge<any>();
      const state = typeof bridge.getState === 'function' ? bridge.getState() : bridge;
      return {
        activeTheme: state?.activeTheme ?? null,
        themeLayouts: state?.themeLayouts ?? {},
        themeStyleVariants: state?.themeStyleVariants ?? {},
        themeVariables: state?.themeVariables ?? {},
        settings: state?.settings ?? {},
        menuItems: Array.isArray(state?.menuItems) ? state.menuItems : [],
        collections: Array.isArray(state?.collections) ? state.collections : [],
        plugins: Array.isArray(state?.plugins) ? state.plugins : [],
      };
    };

    let metadata = read();

    if (!metadata.activeTheme && ensureLoaded) {
      const bridge = RuntimeBridge.getBridge<any>();
      if (typeof bridge.loadConfig === 'function') {
        await bridge.loadConfig(SystemConstants.API_PATH.SYSTEM.FRONTEND);
        metadata = read();
      }
    }

    return metadata;
  }

  private static normalizeApiBaseUrlCandidate(value: unknown): string {
    const normalized = ApplicationUrlUtils.normalizeBaseUrlCandidate(value, { stripApiPath: true });
    if (!normalized) {
      return '';
    }

    const translated = ApplicationUrlUtils.translateBaseUrlToApp(normalized, ApplicationUrlUtils.API_APP);
    if (translated && translated !== normalized) {
      return translated;
    }

    const parsed = ApplicationUrlUtils.parseAbsoluteUrl(normalized);
    if (!parsed || ApplicationUrlUtils.isLoopbackCandidate(parsed)) {
      return normalized;
    }

    const hostname = parsed.hostname;
    for (const app of [ApplicationUrlUtils.ADMIN_APP, ApplicationUrlUtils.FRONTEND_APP]) {
      if (hostname === app || hostname.startsWith(`${app}.`)) {
        const nextHostname = hostname.replace(
          new RegExp(`^${app}(?=\\.|$)`, 'i'),
          ApplicationUrlUtils.API_APP,
        );
        return `${parsed.protocol}//${nextHostname}${parsed.port ? `:${parsed.port}` : ''}`;
      }
    }

    return normalized;
  }
}
