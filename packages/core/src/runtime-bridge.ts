import { SystemConstants } from './constants';
import { RuntimeConstants } from './runtime-constants';
import type { FrontendRuntimeMetadata } from './runtime-bridge.interfaces';

/**
 * Utilities for accessing the Fromcode framework's shared browser runtime.
 */
export class RuntimeBridge {
  static resolveApiBaseUrl(options: { fallbackHost?: string } = {}): string {
    const fallbackHost = String(options.fallbackHost || 'api.framework.local').trim() || 'api.framework.local';

    const normalizeBaseCandidate = (value: any): string => {
      const rawValue = String(value || '').trim();
      if (!rawValue) {
        return '';
      }

      try {
        if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) {
          const parsed = new URL(rawValue);
          return RuntimeBridge.stripApiPath(`${parsed.origin}${parsed.pathname || ''}`);
        }

        if (rawValue.startsWith('/')) {
          return '';
        }

        return RuntimeBridge.stripApiPath(`http://${rawValue}`);
      } catch {
        return '';
      }
    };

    if (typeof window === 'undefined') {
      const fromEnv = normalizeBaseCandidate(process.env.NEXT_PUBLIC_API_URL || process.env.API_URL);
      return fromEnv || `http://${fallbackHost}`;
    }

    const fromBridge = normalizeBaseCandidate((window as any)?.FROMCODE_API_URL);
    if (fromBridge) return fromBridge;

    const fromGlobal = normalizeBaseCandidate((window as any)?.Fromcode?.apiUrl);
    if (fromGlobal) return fromGlobal;

    const runtimeBridge = RuntimeBridge.getBridge<any>();
    const fromRuntimeBridge = normalizeBaseCandidate(runtimeBridge?.apiUrl);
    if (fromRuntimeBridge) return fromRuntimeBridge;

    const fromEnv = normalizeBaseCandidate(process.env.NEXT_PUBLIC_API_URL);
    if (fromEnv) return fromEnv;

    const protocol = window.location?.protocol || 'http:';
    return `${protocol}//${fallbackHost}`;
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

  private static stripApiPath(value: string): string {
    return String(value || '')
      .replace(/\/+$/, '')
      .replace(/\/api\/v\d+$/i, '')
      .replace(/\/api$/i, '');
  }
}
