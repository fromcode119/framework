import { ClientType } from '@fromcode119/core/client';
import React from 'react';
import { ApiVersionUtils, BrowserStateClient, CookieConstants, SystemConstants } from '@fromcode119/core/client';
import type { ICollectionMetadata } from '@react/interfaces/collection-metadata.interface';
import type { ISecondaryPanelState } from '@react/interfaces/secondary-panel-state.interface';
import { ContextProviderStateService } from '@react/context/context-provider-state-service';
import { ContextProviderConfigLoaderHooks } from '@react/context/context-provider-config-loader-hooks';

export class ContextProviderApiHooks {
  static useApiRuntime(args: {
    apiUrl: string;
    clientType: ClientType;
    browserState: BrowserStateClient;
    locale: string;
    settings: Record<string, any>;
    setServerRuntimeModules: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setPlugins: React.Dispatch<React.SetStateAction<any[]>>;
    setCollections: React.Dispatch<React.SetStateAction<ICollectionMetadata[]>>;
    setMenuItems: React.Dispatch<React.SetStateAction<any[]>>;
    setSecondaryPanel: React.Dispatch<React.SetStateAction<ISecondaryPanelState>>;
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
      // NO Authorization header is built here. Every surface authenticates by its own `httpOnly`
      // session cookie, which the browser attaches unaided under `credentials: 'include'` — verified
      // live: `auth/me/person` answers 200 with cookies and no Bearer, 401 with the cookies omitted.
      // Reading a token here required the token to be readable by scripts, which is exactly what
      // defeated the server's `httpOnly` (see CookieConstants.CLIENT_SESSION_MARKER). Dropping it also
      // deletes the old hazard where a frontend plugin asking for admin-ui context would send the
      // storefront token as Bearer and shadow the admin `fc_token` cookie.
      const existingHeaders = (fetchOptions.headers || {}) as Record<string, string>;
      const csrfToken = browserState.readCookie(CookieConstants.AUTH_CSRF);
      // Only ever used to keep the GET dedupe cache for a signed-in visitor separate from a guest's.
      // It is a flag, not a credential — the request authenticates by cookie.
      const hasSession = Boolean(browserState.readCookie(CookieConstants.CLIENT_SESSION_MARKER));
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

      const dedupeKey = `${url}|${fetchOptions.credentials || 'include'}|${hasSession ? 'auth' : 'anon'}`;
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

        // No `&preview=1` here. This used to append it from the page URL and again for any framed
        // render, back when the API OR-ed that parameter into its preview decision — i.e. it was the
        // browser-side half of the hole where `?preview=1` handed drafts to anyone. The API now
        // decides preview purely from the caller's roles/permissions, so appending it would be a
        // parameter nothing reads. This call resolves with whatever session the browser presents,
        // which on the storefront origin is the visitor's, never the admin's (`fc_token` is only
        // accepted on the admin surface). Operator preview is an SSR concern: the storefront's
        // server render forwards the admin session for a `preview=1` navigation.
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
