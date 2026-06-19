import React from 'react';
import {
  ApiVersionUtils,
  BrowserStateClient,
  CookieConstants,
  SystemConstants,
} from '@fromcode119/core/client';
import type { CollectionMetadata, SecondaryPanelState } from '../context.interfaces';
import { ContextProviderStateService } from './context-provider-state-service';
import { ContextProviderConfigLoaderHooks } from './context-provider-config-loader-hooks';

export class ContextProviderApiHooks {
  static useApiRuntime(args: {
    apiUrl: string;
    clientType: 'admin-ui' | 'frontend-ui';
    browserState: BrowserStateClient;
    locale: string;
    settings: Record<string, any>;
    setServerRuntimeModules: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setPlugins: React.Dispatch<React.SetStateAction<any[]>>;
    setCollections: React.Dispatch<React.SetStateAction<CollectionMetadata[]>>;
    setMenuItems: React.Dispatch<React.SetStateAction<any[]>>;
    setSecondaryPanel: React.Dispatch<React.SetStateAction<SecondaryPanelState>>;
    setSettings: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setActiveTheme: React.Dispatch<React.SetStateAction<any>>;
    setThemeVariables: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setIsReady: React.Dispatch<React.SetStateAction<boolean>>;
    inFlightConfigLoadsRef: React.MutableRefObject<Map<string, Promise<any>>>;
    loadedConfigPathsRef: React.MutableRefObject<Set<string>>;
    stabilityRef: React.MutableRefObject<any>;
  }) {
    const {
      apiUrl,
      browserState,
      clientType,
      inFlightConfigLoadsRef,
      loadedConfigPathsRef,
      locale,
      setActiveTheme,
      setCollections,
      setIsReady,
      setMenuItems,
      setPlugins,
      setSecondaryPanel,
      setServerRuntimeModules,
      setSettings,
      setThemeVariables,
      settings,
      stabilityRef,
    } = args;

    const getBaseURL = React.useCallback(() => (
      apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
    ), [apiUrl]);

    const apiFetch = React.useCallback(async (
      path: string,
      options: RequestInit & { silent?: boolean; noDedupe?: boolean } = {},
    ) => {
      const { silent, noDedupe, ...fetchOptions } = options as any;
      if (typeof path !== 'string' || !path.trim()) {
        throw new Error('[Fromcode API] Missing request path');
      }

      const base = getBaseURL();
      const version = ApiVersionUtils.normalize();
      const normalizedPath = path.trim();
      let url = normalizedPath;

      if (!normalizedPath.startsWith('http')) {
        const versionPrefix = ApiVersionUtils.prefix(version);
        const relativePath = normalizedPath.startsWith(versionPrefix)
          ? normalizedPath.slice(versionPrefix.length)
          : normalizedPath;
        url = `${base}${versionPrefix}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
      }

      // Read caller headers first so we can respect an explicit X-Framework-Client override.
      // When a frontend plugin requests admin-ui context (e.g. the CMS visual editor), we must
      // NOT send the frontend userToken as Bearer — it would authenticate as a non-admin user and
      // shadow the fc_token cookie (which carries the admin role). Let the cookie travel on its own.
      const existingHeaders = (fetchOptions.headers || {}) as Record<string, string>;
      const explicitClientType = existingHeaders['X-Framework-Client'] || existingHeaders['x-framework-client'] || '';
      const token = (explicitClientType === 'admin-ui')
        ? ''
        : (clientType === 'frontend-ui' ? browserState.readCookie(CookieConstants.CLIENT_AUTH_TOKEN) : '');
      const csrfToken = browserState.readCookie(CookieConstants.AUTH_CSRF);
      const method = String(fetchOptions.method || 'GET').toUpperCase();
      const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);

      const execute = async () => {
        const response = await fetch(url, {
          ...fetchOptions,
          credentials: fetchOptions.credentials || 'include',
          headers: {
            ...existingHeaders,
            ...(!existingHeaders['X-Framework-Client'] ? { 'X-Framework-Client': clientType } : {}),
            ...(isUnsafeMethod && !existingHeaders['X-Requested-With'] ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
            ...(isUnsafeMethod && csrfToken && !existingHeaders['X-CSRF-Token'] ? { 'X-CSRF-Token': csrfToken } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!response.ok) {
          if (response.status === 404 && url.includes(SystemConstants.API_PATH.SYSTEM.RESOLVE)) {
            return null;
          }

          const errorPayload = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          if (!silent) {
            console.error(`[Fromcode API] Error ${response.status} from ${url}:`, errorPayload);
          }

          const requestError = new Error(errorPayload.error || `Failed to fetch from ${url}`) as Error & {
            statusCode?: number;
            data?: unknown;
            url?: string;
          };
          requestError.statusCode = response.status;
          requestError.data = errorPayload;
          requestError.url = url;
          throw requestError;
        }

        return response.json();
      };

      const canDedupe =
        method === 'GET' &&
        !noDedupe &&
        !fetchOptions.body &&
        !String(fetchOptions.cache || '').toLowerCase().includes('no-store');

      if (!canDedupe) {
        return execute();
      }

      const dedupeKey = `${url}|${fetchOptions.credentials || 'include'}|${token ? 'auth' : 'anon'}`;
      const now = Date.now();
      const cachedResponse = ContextProviderStateService.cachedGetResponses.get(dedupeKey);
      if (cachedResponse && cachedResponse.expiresAt > now) {
        return cachedResponse.data;
      }

      const cachedError = ContextProviderStateService.cachedGetErrors.get(dedupeKey);
      if (cachedError && cachedError.expiresAt > now) {
        throw cachedError.error;
      }

      const inFlightRequest = ContextProviderStateService.inFlightGetRequests.get(dedupeKey);
      if (inFlightRequest) {
        return inFlightRequest;
      }

      const request = execute()
        .then((data) => {
          ContextProviderStateService.cachedGetResponses.set(dedupeKey, {
            expiresAt: Date.now() + ContextProviderStateService.GET_RESPONSE_TTL_MS,
            data,
          });
          ContextProviderStateService.cachedGetErrors.delete(dedupeKey);
          return data;
        })
        .catch((error) => {
          ContextProviderStateService.cachedGetErrors.set(dedupeKey, {
            expiresAt: Date.now() + ContextProviderStateService.GET_ERROR_TTL_MS,
            error,
          });
          throw error;
        })
        .finally(() => {
          ContextProviderStateService.inFlightGetRequests.delete(dedupeKey);
        });

      ContextProviderStateService.inFlightGetRequests.set(dedupeKey, request);
      return request;
    }, [browserState, clientType, getBaseURL]);

    const api = React.useMemo(() => ({
      getBaseUrl: () => getBaseURL(),
      get: (path: string, options?: any) => apiFetch(path, { ...options, method: 'GET' }),
      post: (path: string, body?: any, options?: any) => {
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        return apiFetch(path, {
          ...options,
          method: 'POST',
          headers: isFormData ? (options?.headers || {}) : { 'Content-Type': 'application/json', ...(options?.headers || {}) },
          body: isFormData ? body : JSON.stringify(body),
        });
      },
      put: (path: string, body?: any, options?: any) => {
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        return apiFetch(path, {
          ...options,
          method: 'PUT',
          headers: isFormData ? (options?.headers || {}) : { 'Content-Type': 'application/json', ...(options?.headers || {}) },
          body: isFormData ? body : JSON.stringify(body),
        });
      },
      patch: (path: string, body?: any, options?: any) => {
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        return apiFetch(path, {
          ...options,
          method: 'PATCH',
          headers: isFormData ? (options?.headers || {}) : { 'Content-Type': 'application/json', ...(options?.headers || {}) },
          body: isFormData ? body : JSON.stringify(body),
        });
      },
      delete: (path: string, options?: any) => apiFetch(path, { ...options, method: 'DELETE' }),
    }), [apiFetch, getBaseURL]);

    const { loadConfig } = ContextProviderConfigLoaderHooks.useConfigLoader({
      apiFetch,
      getBaseURL,
      setServerRuntimeModules,
      setPlugins,
      setCollections,
      setMenuItems,
      setSecondaryPanel,
      setSettings,
      setActiveTheme,
      setThemeVariables,
      setIsReady,
      inFlightConfigLoadsRef,
      loadedConfigPathsRef,
    });

    const resolveContent = React.useCallback(async (slug: string) => {
      try {
        const normalizedSlug = (slug || '').trim();
        if (!normalizedSlug) {
          return null;
        }

        let query = `?slug=${encodeURIComponent(normalizedSlug)}`;
        if (locale) {
          query += `&locale=${encodeURIComponent(String(locale))}`;
        }

        const fallbackLocale = String(
          settings?.fallback_locale ||
          settings?.frontend_default_locale ||
          settings?.default_locale ||
          '',
        ).trim();
        if (fallbackLocale) {
          query += `&fallback_locale=${encodeURIComponent(fallbackLocale)}`;
        }

        if (typeof window !== 'undefined') {
          const currentUrl = new URL(window.location.href);
          const params = currentUrl.searchParams;
          if (params.get('preview') === '1') {
            query += '&preview=1';
          }

          if (window.self !== window.top) {
            query += '&preview=1';
          }
        }

        return await api.get(`${SystemConstants.API_PATH.SYSTEM.RESOLVE}${query}`, { silent: true });
      } catch {
        return null;
      }
    }, [api, locale, settings?.default_locale, settings?.fallback_locale, settings?.frontend_default_locale]);

    const getFrontendMetadata = React.useCallback(async (options?: { ensureLoaded?: boolean }) => {
      const ensureLoaded = options?.ensureLoaded !== false;
      if (ensureLoaded && !stabilityRef.current.activeTheme) {
        await stabilityRef.current.loadConfig(ContextProviderStateService.getFrontendConfigPath());
      }

      const state = stabilityRef.current;
      return {
        activeTheme: state.activeTheme ?? null,
        themeLayouts: state.themeLayouts ?? {},
        themeVariables: state.themeVariables ?? {},
        settings: state.settings ?? {},
        menuItems: Array.isArray(state.menuItems) ? state.menuItems : [],
        secondaryPanel: state.secondaryPanel ?? ContextProviderStateService.createEmptySecondaryPanelState(),
        collections: Array.isArray(state.collections) ? state.collections : [],
        plugins: Array.isArray(state.plugins) ? state.plugins : [],
      };
    }, [stabilityRef]);

    return {
      api,
      getBaseURL,
      resolveContent,
      loadConfig,
      getFrontendMetadata,
    };
  }
}
