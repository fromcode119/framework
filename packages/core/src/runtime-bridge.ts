import { ApplicationUrlUtils } from './application-url-utils';
import { SystemConstants } from './constants';
import { RuntimeConstants } from './runtime-constants';
import type { FrontendRuntimeMetadata } from './runtime-bridge.interfaces';

/**
 * Utilities for accessing the Fromcode framework's shared browser runtime.
 */
export class RuntimeBridge {
  static resolveApiBaseUrl(options: { fallbackHost?: string } = {}): string {
    const fallbackBaseUrl = RuntimeBridge.normalizeApiBaseUrlCandidate(options.fallbackHost);

    if (typeof window === 'undefined') {
      return RuntimeBridge.normalizeApiBaseUrlCandidate(
        ApplicationUrlUtils.readEnvironmentBaseUrl(['NEXT_PUBLIC_API_URL', 'API_URL'], { stripApiPath: true }),
      )
        || fallbackBaseUrl;
    }

    const fromBridge = RuntimeBridge.normalizeApiBaseUrlCandidate((window as any)?.FROMCODE_API_URL);
    if (fromBridge) return fromBridge;

    const fromGlobal = RuntimeBridge.normalizeApiBaseUrlCandidate((window as any)?.Fromcode?.apiUrl);
    if (fromGlobal) return fromGlobal;

    const runtimeBridge = RuntimeBridge.getBridge<any>();
    const fromRuntimeBridge = RuntimeBridge.normalizeApiBaseUrlCandidate(runtimeBridge?.apiUrl);
    if (fromRuntimeBridge) return fromRuntimeBridge;

    const fromEnv = RuntimeBridge.normalizeApiBaseUrlCandidate(
      ApplicationUrlUtils.readEnvironmentBaseUrl(['NEXT_PUBLIC_API_URL', 'API_URL'], { stripApiPath: true }),
    );
    if (fromEnv) return fromEnv;

    return ApplicationUrlUtils.inferBrowserBaseUrl(ApplicationUrlUtils.API_APP) || fallbackBaseUrl;
  }

  /**
   * Resolves the framework's internal bridge for a specific runtime module.
   * Used by plugins to communicate with the shared singleton state.
   */
  static getBridge<T = any>(moduleName: string = '@fromcode119/react'): T {
    if (typeof window === 'undefined') return {} as T;
    const win = window as any;
    const modules = win[RuntimeConstants.GLOBALS.MODULES];
    return (modules?.[moduleName]) || win[RuntimeConstants.GLOBALS.FROMCODE] || {};
  }

  static async getMetadata(options: { ensureLoaded?: boolean } = {}): Promise<FrontendRuntimeMetadata> {
    const ensureLoaded = options.ensureLoaded !== false;

    const read = (): FrontendRuntimeMetadata => {
      const bridge = RuntimeBridge.getBridge<any>();
      const state = typeof bridge.getState === 'function' ? bridge.getState() : bridge;
      return {
        activeTheme: state?.activeTheme ?? null,
        themeLayouts: state?.themeLayouts ?? {},
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
