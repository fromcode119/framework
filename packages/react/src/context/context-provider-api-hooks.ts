import React from 'react';
import ReactDOM from 'react-dom';
import {
  ApiPathUtils,
  ApiVersionUtils,
  BrowserStateClient,
  CookieConstants,
  SystemConstants,
} from '@fromcode119/core/client';
import type { CollectionMetadata, SecondaryPanelState } from '../context.interfaces';
import { ContextProviderStateService } from './context-provider-state-service';

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

      const token = clientType === 'frontend-ui'
        ? browserState.readCookie(CookieConstants.CLIENT_AUTH_TOKEN)
        : '';
      const csrfToken = browserState.readCookie(CookieConstants.AUTH_CSRF);
      const method = String(fetchOptions.method || 'GET').toUpperCase();
      const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      const existingHeaders = (fetchOptions.headers || {}) as Record<string, string>;

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

    const loadThemeEntry = React.useCallback(async (baseUrl: string, theme: any) => {
      const themeSlug = String(theme?.slug || '').trim();
      const themeEntry = String(theme?.ui?.entry || '').trim();
      if (!themeSlug || !themeEntry || typeof document === 'undefined') {
        return;
      }

      const entryUrl = themeEntry.startsWith('http')
        ? themeEntry
        : ApiPathUtils.themeUiAssetUrl(baseUrl, themeSlug, themeEntry);
      const registry = ((window as any).__fromcodeLoadedThemeEntries ||= new Set<string>()) as Set<string>;
      if (registry.has(entryUrl)) {
        return;
      }

      const preloadSelector = `link[rel="modulepreload"][href="${entryUrl}"]`;
      if (!document.head.querySelector(preloadSelector)) {
        const preloadLink = document.createElement('link');
        preloadLink.rel = 'modulepreload';
        preloadLink.href = entryUrl;
        preloadLink.setAttribute('data-theme-entry-preload', entryUrl);
        document.head.appendChild(preloadLink);
      }

      await import(/* webpackIgnore: true */ entryUrl);
      registry.add(entryUrl);
    }, []);

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

    const loadConfig = React.useCallback(async (path?: string) => {
      const resolvedPath = (typeof path === 'string' && path.trim())
        ? path.trim()
        : ContextProviderStateService.getFrontendConfigPath();
      const isFrontendConfigPath = resolvedPath === ContextProviderStateService.getFrontendConfigPath();
      if (isFrontendConfigPath && loadedConfigPathsRef.current.has(resolvedPath)) {
        return;
      }

      const inFlightRequest = inFlightConfigLoadsRef.current.get(resolvedPath);
      if (inFlightRequest) {
        return inFlightRequest;
      }

      const request = (async () => {
        try {
          const base = getBaseURL();
          const data = await apiFetch(resolvedPath, { method: 'GET', silent: true });

          if (data.runtimeModules) {
            setServerRuntimeModules(data.runtimeModules);
          }

          if (data.plugins) {
            setPlugins(data.plugins);
            const allCollections: CollectionMetadata[] = [];
            data.plugins.forEach((plugin: any) => {
              if (plugin.admin?.collections) {
                allCollections.push(...plugin.admin.collections.map((collection: any) => ({
                  ...collection,
                  pluginSlug: plugin.slug,
                })));
              }
            });
            setCollections(allCollections);
          }

          if (data.menu) {
            setMenuItems(data.menu);
          }

          setSecondaryPanel(data.secondaryPanel || ContextProviderStateService.createEmptySecondaryPanelState());

          if (data.settings) {
            setSettings(data.settings);
          }

          if (data.cssVariables) {
            let style = document.getElementById('fc-theme-variables');
            if (!style) {
              style = document.createElement('style');
              style.id = 'fc-theme-variables';
              document.head.appendChild(style);
            }
            style.textContent = data.cssVariables;
          }

          if (data.activeTheme) {
            setActiveTheme(data.activeTheme);
            setThemeVariables(data.activeTheme.variables || {});

            const theme = data.activeTheme;
            if (theme.ui?.css) {
              theme.ui.css.forEach((cssPath: string) => {
                const fullUrl = cssPath.startsWith('http')
                  ? cssPath
                  : ApiPathUtils.themeUiAssetUrl(base, theme.slug, cssPath);
                if (!document.querySelector(`link[href="${fullUrl}"]`)) {
                  const link = document.createElement('link');
                  link.rel = 'stylesheet';
                  link.href = fullUrl;
                  document.head.appendChild(link);
                }
              });
            }

            try {
              await loadThemeEntry(base, theme);
            } catch (error) {
              console.warn('[Fromcode] Failed to load theme bundle:', error);
            }
          }

          loadedConfigPathsRef.current.add(resolvedPath);
          setIsReady(true);
        } catch (error) {
          console.warn('[Fromcode] Failed to load config:', error);
          setIsReady(true);
        }
      })().finally(() => {
        inFlightConfigLoadsRef.current.delete(resolvedPath);
      });

      inFlightConfigLoadsRef.current.set(resolvedPath, request);
      return request;
    }, [
      apiFetch,
      getBaseURL,
      loadThemeEntry,
      inFlightConfigLoadsRef,
      loadedConfigPathsRef,
      setActiveTheme,
      setCollections,
      setIsReady,
      setMenuItems,
      setPlugins,
      setSecondaryPanel,
      setServerRuntimeModules,
      setSettings,
      setThemeVariables,
    ]);

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
