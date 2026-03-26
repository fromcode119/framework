"use client";

import React, { useState, ReactNode, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { PluginContextRegistry } from './plugin-context';
import { SystemConstants, ApiVersionUtils, CookieConstants, BrowserStateClient } from '@fromcode119/core/client';
import { FrameworkIcons } from './framework-icons';
import { FrameworkIconRegistry } from './framework-icon-registry';
import { RootFramework } from './root-framework';
import { SystemShortcodes } from './system-shortcodes';
import { CollectionQueryUtils } from './collection-queries';
import { BrowserLocalization } from './browser-localization';
import { RuntimeConstants, RelationUtils, CoercionUtils, StringUtils, NumberUtils, FormatUtils, LocalizationUtils, CollectionUtils, PaginationUtils, HookEventUtils } from '@fromcode119/core/client';
import type { SlotComponent, MenuItem, CollectionMetadata, PluginContextValue } from './context.interfaces';
import { ContextRuntimeBridge } from './context-runtime-bridge';

type PluginsProviderProps = {
  children: ReactNode;
  apiUrl?: string;
  runtimeModules?: Record<string, any>;
};

const inFlightGetRequests = new Map<string, Promise<any>>();

const getFrontendConfigPath = (): string => {
  const path = SystemConstants?.API_PATH?.SYSTEM?.FRONTEND;
  if (!path) {
    throw new Error('[Fromcode API] Missing SYSTEM.FRONTEND path constant');
  }
  return path;
};

const getPluginApiRegistryKey = (namespace: string, slug: string): string => {
  const normalizedNamespace = String(namespace || '').trim().toLowerCase();
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  return `${normalizedNamespace}:${normalizedSlug}`;
};

const getIcon = FrameworkIcons.getIcon.bind(FrameworkIcons);
const createProxyIcon = FrameworkIcons.createProxyIcon.bind(FrameworkIcons);
const iconNames = FrameworkIcons.iconNames();

const usePluginsBridgeHook = (): PluginContextValue => {
  const context = React.useContext(PluginContextRegistry.Context);
  if (!context) {
    throw new Error('usePlugins must be used within a PluginsProvider');
  }

  return context;
};

const useTranslationBridgeHook = () => {
  const { t, locale, setLocale } = usePluginsBridgeHook();
  return { t, locale, setLocale };
};

const usePluginApiBridgeHook = (slug: string) => {
  const { api } = usePluginsBridgeHook();
  const pluginPrefix = `${SystemConstants.API_PATH.PLUGINS.BASE}/${slug}`;

  return React.useMemo(
    () => ({
      get: (path: string, options?: any) =>
        api.get(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, options),
      post: (path: string, body?: any, options?: any) =>
        api.post(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, body, options),
      put: (path: string, body?: any, options?: any) =>
        api.put(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, body, options),
      delete: (path: string, options?: any) =>
        api.delete(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, options),
      patch: (path: string, body?: any, options?: any) =>
        api.patch(`${pluginPrefix}${path.startsWith('/') ? '' : '/'}${path}`, body, options),
    }),
    [api, pluginPrefix],
  );
};

const usePluginStateBridgeHook = (pluginSlug: string, key?: string) => {
  const { pluginState, setPluginState } = usePluginsBridgeHook();
  const state = pluginState[pluginSlug] || {};

  const setter = React.useCallback(
    (value: any) => {
      if (key) {
        setPluginState(pluginSlug, key, value);
        return;
      }
      Object.entries(value).forEach(([entryKey, entryValue]) => {
        setPluginState(pluginSlug, entryKey, entryValue);
      });
    },
    [pluginSlug, key, setPluginState],
  );

  if (key) {
    return [state[key], setter] as const;
  }

  return [state, setter] as const;
};

const PluginsProviderInternal = ({ children, apiUrl, runtimeModules }: PluginsProviderProps) => {
  const [slots, setSlots] = useState<Record<string, SlotComponent[]>>({});
  const [overrides, setOverrides] = useState<Record<string, SlotComponent>>({});
  const [themeVariables, setThemeVariables] = useState<Record<string, string>>({});
  const [themeLayouts, setThemeLayouts] = useState<Record<string, any>>({});
  const [activeTheme, setActiveTheme] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [collections, setCollections] = useState<CollectionMetadata[]>([]);
  const [fieldComponents, setFieldComponents] = useState<Record<string, any>>({});
  const [plugins, setPlugins] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [pluginState, setPluginStateInternal] = useState<Record<string, Record<string, any>>>({});
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [locale, setLocale] = useState<string>('en');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [pluginAPIs] = useState<Record<string, any>>({});
  const [events] = useState(() => new Map<string, Set<(data: any) => void>>());
  const [serverRuntimeModules, setServerRuntimeModules] = useState<Record<string, any>>({});
  const browserState = useMemo(() => new BrowserStateClient(), []);
  
  const getBaseURL = useCallback(() => {
    const bridgeUrl = typeof window !== 'undefined' ? (window as any).FROMCODE_API_URL : '';
    let effectiveApiUrl = apiUrl || bridgeUrl || 'http://api.framework.local';
    
    if (!effectiveApiUrl.startsWith('http') && !effectiveApiUrl.startsWith('/')) {
      effectiveApiUrl = `http://${effectiveApiUrl}`;
    }
    
    return effectiveApiUrl.endsWith('/') ? effectiveApiUrl.slice(0, -1) : effectiveApiUrl;
  }, [apiUrl]);

  const apiFetch = useCallback(async (path: string, options: (RequestInit & { silent?: boolean; noDedupe?: boolean }) = {}) => {
    const { silent, noDedupe, ...fetchOptions } = options as any;
    if (typeof path !== 'string' || !path.trim()) {
      throw new Error('[Fromcode API] Missing request path');
    }
    const base = getBaseURL();
    const version = ApiVersionUtils.normalize();
    
    const normalizedPath = path.trim();
    let url = normalizedPath;
    if (!normalizedPath.startsWith('http')) {
      const vPrefix = ApiVersionUtils.prefix(version);
      // Prevent double prefixing if path already starts with API version prefix
      const relativePath = normalizedPath.startsWith(vPrefix) ? normalizedPath.slice(vPrefix.length) : normalizedPath;
      url = `${base}${vPrefix}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
    }
    
    const token = browserState.readCookie(CookieConstants.AUTH_TOKEN);
    const csrfToken = browserState.readCookie(CookieConstants.AUTH_CSRF);
    const method = String(fetchOptions.method || 'GET').toUpperCase();
    const isUnsafeMethod = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    const existingHeaders = (fetchOptions.headers || {}) as Record<string, string>;

    const execute = async () => {
      const res = await fetch(url, {
        ...fetchOptions,
        credentials: fetchOptions.credentials || 'include',
        headers: {
          ...existingHeaders,
          ...(isUnsafeMethod && !existingHeaders['X-Framework-Client'] ? { 'X-Framework-Client': 'frontend-ui' } : {}),
          ...(isUnsafeMethod && !existingHeaders['X-Requested-With'] ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
          ...(isUnsafeMethod && csrfToken && !existingHeaders['X-CSRF-Token'] ? { 'X-CSRF-Token': csrfToken } : {}),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
          if (res.status === 404 && url.includes(SystemConstants.API_PATH.SYSTEM.RESOLVE)) {
            return null;
          }
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          if (!silent) {
            console.error(`[Fromcode API] Error ${res.status} from ${url}:`, err);
          }
          const requestError = new Error(err.error || `Failed to fetch from ${url}`) as Error & {
            statusCode?: number;
            data?: unknown;
            url?: string;
          };
          requestError.statusCode = res.status;
          requestError.data = err;
          requestError.url = url;
          throw requestError;
      }
      return res.json();
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
    const inFlight = inFlightGetRequests.get(dedupeKey);
    if (inFlight) return inFlight;

    const promise = execute().finally(() => {
      inFlightGetRequests.delete(dedupeKey);
    });
    inFlightGetRequests.set(dedupeKey, promise);
    return promise;
  }, [browserState, getBaseURL]);

  const api = useMemo(() => ({
    getBaseUrl: () => getBaseURL(),
    get: (path: string, options?: any) => apiFetch(path, { ...options, method: 'GET' }),
    post: (path: string, body?: any, options?: any) => {
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        return apiFetch(path, { 
            ...options, 
            method: 'POST', 
            headers: isFormData ? (options?.headers || {}) : { 'Content-Type': 'application/json', ...(options?.headers || {}) },
            body: isFormData ? body : JSON.stringify(body)
        });
    },
    put: (path: string, body?: any, options?: any) => {
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        return apiFetch(path, { 
            ...options, 
            method: 'PUT', 
            headers: isFormData ? (options?.headers || {}) : { 'Content-Type': 'application/json', ...(options?.headers || {}) },
            body: isFormData ? body : JSON.stringify(body)
        });
    },
    patch: (path: string, body?: any, options?: any) => {
        const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
        return apiFetch(path, { 
            ...options, 
            method: 'PATCH', 
            headers: isFormData ? (options?.headers || {}) : { 'Content-Type': 'application/json', ...(options?.headers || {}) },
            body: isFormData ? body : JSON.stringify(body)
        });
    },
    delete: (path: string, options?: any) => apiFetch(path, { ...options, method: 'DELETE' }),
  }), [apiFetch]);

  const resolveContent = useCallback(async (slug: string) => {
    try {
        const normalizedSlug = (slug || '').trim();
        if (!normalizedSlug) return null;

        let query = `?slug=${encodeURIComponent(normalizedSlug)}`;
        if (locale) {
          query += `&locale=${encodeURIComponent(String(locale))}`;
        }
        const fallbackLocale = String(
          settings?.fallback_locale ||
          settings?.frontend_default_locale ||
          settings?.default_locale ||
          ''
        ).trim();
        if (fallbackLocale) {
          query += `&fallback_locale=${encodeURIComponent(fallbackLocale)}`;
        }
        if (typeof window !== 'undefined') {
          // Check both current URL and possible referer URL for flags
          const currentUrl = new URL(window.location.href);
          const params = currentUrl.searchParams;
          
          if (params.get('preview') === '1') {
            query += '&preview=1';
          }
          
          // Also check if we are in an iframe (preview mode often uses iframes)
          if (window.self !== window.top) {
             query += '&preview=1';
          }
        }
        const result = await api.get(`${SystemConstants.API_PATH.SYSTEM.RESOLVE}${query}`, { silent: true });
        return result;
    } catch (e) {
        return null;
    }
  }, [api, locale, settings?.default_locale, settings?.frontend_default_locale, settings?.fallback_locale]);

  const loadConfig = useCallback(async (path?: string) => {
    try {
      const resolvedPath = (typeof path === 'string' && path.trim()) ? path.trim() : getFrontendConfigPath();
      const base = getBaseURL();
      const data = await apiFetch(resolvedPath, { method: 'GET', silent: true });
      
      // Store server runtime modules for the consolidated import map logic in useEffect
      if (data.runtimeModules) {
        setServerRuntimeModules(data.runtimeModules);
      }

      // Handle Admin Metadata if present
      if (data.plugins) {
        setPlugins(data.plugins);
        const allCollections: CollectionMetadata[] = [];
        data.plugins.forEach((p: any) => {
          if (p.admin?.collections) {
            allCollections.push(...p.admin.collections.map((c: any) => ({
              ...c,
              pluginSlug: p.slug // Ensure pluginSlug is present for resolution
            })));
          }
        });
        setCollections(allCollections);
      }

      if (data.menu) {
        setMenuItems(data.menu);
      }

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
        const baseThemeUrl = `${base}/themes/${theme.slug}`;

        // Load Theme CSS
        if (theme.ui?.css) {
           theme.ui.css.forEach((cssPath: string) => {
              const fullUrl = cssPath.startsWith('http') ? cssPath : `${baseThemeUrl}/ui/${cssPath}`;
              if (!document.querySelector(`link[href="${fullUrl}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = fullUrl;
                document.head.appendChild(link);
              }
           });
        }

        // Load Theme JS Bundle (Entry) — theme bundles are built as IIFE (Vite).
        // IIFE bundles reference React/ReactDOM as globals, so we expose them on
        // window before injecting the script tag.
        if (theme.ui?.entry) {
          const entryUrl = theme.ui.entry.startsWith('http') ? theme.ui.entry : `${baseThemeUrl}/ui/${theme.ui.entry}`;
          if (!document.querySelector(`script[data-theme-entry="${entryUrl}"]`)) {
            (window as any).React = React;
            (window as any).ReactDOM = ReactDOM;
            const script = document.createElement('script');
            script.src = entryUrl;
            script.setAttribute('data-theme-entry', entryUrl);
            script.onerror = (err) => console.warn('[Fromcode] Failed to load theme bundle:', err);
            document.head.appendChild(script);
          }
        }
      }
      setIsReady(true);
    } catch (err) {
      console.warn("[Fromcode] Failed to load config:", err);
      setIsReady(true);
    }
  }, [getBaseURL, apiFetch]);

  const getFrontendMetadata = useCallback(async (options?: { ensureLoaded?: boolean }) => {
    const ensureLoaded = options?.ensureLoaded !== false;

    if (ensureLoaded && !stabilityRef.current.activeTheme) {
      await stabilityRef.current.loadConfig(getFrontendConfigPath());
    }

    const state = stabilityRef.current;
    return {
      activeTheme: state.activeTheme ?? null,
      themeLayouts: state.themeLayouts ?? {},
      themeVariables: state.themeVariables ?? {},
      settings: state.settings ?? {},
      menuItems: Array.isArray(state.menuItems) ? state.menuItems : [],
      collections: Array.isArray(state.collections) ? state.collections : [],
      plugins: Array.isArray(state.plugins) ? state.plugins : []
    };
  }, []);

  const registerPluginApi = useCallback((namespace: string, slug: string, api: any) => {
    pluginAPIs[getPluginApiRegistryKey(namespace, slug)] = api;
  }, [pluginAPIs]);

  const getPluginApi = useCallback((namespace: string, slug: string) => {
    return pluginAPIs[getPluginApiRegistryKey(namespace, slug)];
  }, [pluginAPIs]);

  const hasPluginApi = useCallback((namespace: string, slug: string) => {
    return getPluginApi(namespace, slug) !== undefined;
  }, [getPluginApi]);

  const registerAPI = useCallback((slug: string, api: any) => {
    pluginAPIs[slug] = api;
    registerPluginApi('org.fromcode', slug, api);
  }, [pluginAPIs, registerPluginApi]);

  const getAPI = useCallback((slug: string) => {
    return getPluginApi('org.fromcode', slug) ?? pluginAPIs[slug];
  }, [getPluginApi, pluginAPIs]);

  const setPluginState = useCallback((pluginSlug: string, key: string, value: any) => {
    setPluginStateInternal(prev => ({
      ...prev,
      [pluginSlug]: {
        ...(prev[pluginSlug] || {}),
        [key]: value
      }
    }));
  }, []);

  const emit = useCallback((event: string, data: any) => {
    const handlers = events.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }, [events]);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!events.has(event)) {
      events.set(event, new Set());
    }
    events.get(event)!.add(handler);
    return () => {
      events.get(event)?.delete(handler);
    };
  }, [events]);

  // Helper to load translations
  const loadTranslations = useCallback(async (newLocale: string) => {
    try {
      const encodedLocale = encodeURIComponent(String(newLocale || '').trim() || 'en');
      const data = await (stabilityRef.current.api as any).get(`${SystemConstants.API_PATH.SYSTEM.I18N}?locale=${encodedLocale}`, { silent: true });
      setTranslations(data);
    } catch (err) {
      console.warn("[I18n] Failed to load translations from:", err);
    }
  }, []); // Truly stable

  const triggerRefresh = useCallback(() => {
    setRefreshVersion(v => v + 1);
    // Clear slots and menu items so they can be re-registered
    setSlots({});
    setOverrides({});
    setMenuItems([]);
    setCollections([]);
    
    // Reload translations to pick up any newly activated plugin languages
    loadTranslations(locale);
  }, [locale, loadTranslations]);

  const t = useCallback((key: string, params: Record<string, any> = {}, defaultValue?: string) => {
    let value: any = translations;
    const parts = key.split('.');
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return defaultValue || key;
      }
    }

    if (typeof value !== 'string') return defaultValue || key;

    return value.replace(/\{\{(.+?)\}\}/g, (_, match) => {
      const paramKey = match.trim();
      return params[paramKey] !== undefined ? String(params[paramKey]) : `{{${paramKey}}}`;
    });
  }, [translations]);

  React.useEffect(() => {
    loadTranslations(locale);
  }, [locale, loadTranslations]);

  // Use a ref for state and logic that the bridge needs but should not trigger effect re-runs
  const stabilityRef = React.useRef({
    slots, overrides, themeVariables, themeLayouts, activeTheme, menuItems, collections, 
    fieldComponents, plugins, settings, translations, locale, refreshVersion, isReady,
    triggerRefresh, api, resolveContent, getAPI, getPluginApi, hasPluginApi, setLocale, t, emit, on,
    loadConfig, getFrontendMetadata, serverRuntimeModules, runtimeModules, apiUrl
  });

  React.useEffect(() => {
    stabilityRef.current = {
      slots, overrides, themeVariables, themeLayouts, activeTheme, menuItems, collections, 
      fieldComponents, plugins, settings, translations, locale, refreshVersion, isReady,
      triggerRefresh, api, resolveContent, getAPI, getPluginApi, hasPluginApi, setLocale, t, emit, on,
      loadConfig, getFrontendMetadata, serverRuntimeModules, runtimeModules, apiUrl
    };
  }, [slots, overrides, themeVariables, themeLayouts, activeTheme, menuItems, collections, fieldComponents, plugins, settings, translations, locale, refreshVersion, isReady, triggerRefresh, api, resolveContent, getAPI, getPluginApi, hasPluginApi, setLocale, t, emit, on, loadConfig, getFrontendMetadata, serverRuntimeModules, runtimeModules, apiUrl]);

  // NEW: Stable bridge wrappers to prevent re-injection loops for functions with volatile dependencies
  const stableT = useCallback((...args: any[]) => (stabilityRef.current.t as any)(...args), []);
  const stableLoadConfig = useCallback((path?: string) => {
    const resolvedPath = (typeof path === 'string' && path.trim()) ? path.trim() : getFrontendConfigPath();
    return (stabilityRef.current.loadConfig as any)(resolvedPath);
  }, []);
  const stableGetFrontendMetadata = useCallback((...args: any[]) => (stabilityRef.current.getFrontendMetadata as any)(...args), []);

  const stableApiBridge = useMemo(() => ({
    getBaseUrl: (...args: any[]) => (stabilityRef.current.api as any).getBaseUrl(...args),
    get: (...args: any[]) => (stabilityRef.current.api as any).get(...args),
    post: (...args: any[]) => (stabilityRef.current.api as any).post(...args),
    put: (...args: any[]) => (stabilityRef.current.api as any).put(...args),
    patch: (...args: any[]) => (stabilityRef.current.api as any).patch(...args),
    delete: (...args: any[]) => (stabilityRef.current.api as any).delete(...args),
  }), []);

  const getSlotComponentSignature = useCallback((componentObj: any) => {
    const component = componentObj?.component;
    if (!component) return `missing:${componentObj?.pluginSlug || 'unknown'}`;

    if (typeof component === 'string') {
      return `string:${component}`;
    }

    if (typeof component === 'function') {
      return `fn:${component.displayName || component.name || 'anonymous'}`;
    }

    if ((component as any)?.$$typeof && (component as any)?.type) {
      const type = (component as any).type;
      if (typeof type === 'function') {
        return `react-element:${type.displayName || type.name || 'anonymous'}`;
      }
      if (typeof type === 'string') {
        return `react-element:${type}`;
      }
    }

    if (typeof component === 'object') {
      const obj = component as any;
      if (obj.id) return `object-id:${String(obj.id)}`;
      if (obj.slug) return `object-slug:${String(obj.slug)}`;
      if (obj.name) return `object-name:${String(obj.name)}`;
      if (obj.type && typeof obj.type === 'string') return `object-type:${obj.type}`;
    }

    return `unknown:${componentObj?.pluginSlug || 'unknown'}`;
  }, []);

  const registerSlotComponent = useCallback((slotName: string, component: any, pluginSlug?: string, priority?: number) => {
    if (!component) {
      console.warn(`[Fromcode] Attempted to register undefined component for slot "${slotName}" from plugin "${pluginSlug || 'unknown'}". Ignored.`);
      return;
    }

    // Handle CJS/ESM mismatch where component might be { default: Comp }
    let actualComponent = component;
    if (component && !component.$$typeof && typeof component === 'object' && component.default) {
      actualComponent = component.default;
    }

    // Safety check: if we somehow got undefined after unwrapping, ignore it
    if (!actualComponent) {
      console.warn(`[Fromcode] Component for slot "${slotName}" resolved to undefined. Plugin: ${pluginSlug || 'unknown'}`);
      return;
    }

    let componentObj: SlotComponent;
    if (
      actualComponent &&
      typeof actualComponent === 'object' &&
      (actualComponent as any).component
    ) {
      componentObj = {
        ...(actualComponent as any),
        pluginSlug: (actualComponent as any).pluginSlug || pluginSlug || 'unknown',
        priority: typeof (actualComponent as any).priority === 'number'
          ? (actualComponent as any).priority
          : (priority || 0)
      } as SlotComponent;
    } else {
      // Support both React components and plain descriptor objects (e.g. slot descriptor registrations).
      componentObj = {
        component: actualComponent,
        pluginSlug: pluginSlug || 'unknown',
        priority: priority || 0
      };
    }

    if (!componentObj || !componentObj.component) {
      console.warn(`[Fromcode] Invalid component object for slot "${slotName}" from plugin "${pluginSlug || 'unknown'}".`);
      return;
    }

    setSlots((prev) => {
      const existing = prev[slotName] || [];
      const incomingSignature = getSlotComponentSignature(componentObj);
      const existingIndex = existing.findIndex((item) => {
        if (item.pluginSlug !== componentObj.pluginSlug) return false;
        if (item.component === componentObj.component) return true;
        return getSlotComponentSignature(item) === incomingSignature;
      });

      if (existingIndex >= 0) {
        const current = existing[existingIndex];
        if (current.component === componentObj.component && current.priority === componentObj.priority) {
          return prev;
        }
        const next = [...existing];
        next[existingIndex] = componentObj;
        return {
          ...prev,
          [slotName]: next.sort((a, b) => a.priority - b.priority)
        };
      }

      return {
        ...prev,
        [slotName]: [...existing, componentObj].sort((a, b) => a.priority - b.priority)
      };
    });
  }, [getSlotComponentSignature]);

  const registerFieldComponent = useCallback((name: string, component: any) => {
    if (!component) {
      console.warn(`[Fromcode] Attempted to register undefined field component "${name}". Ignored.`);
      return;
    }

    // Handle CJS/ESM mismatch
    let actualComponent = component;
    if (component && !component.$$typeof && typeof component === 'object' && component.default) {
      actualComponent = component.default;
    }

    if (!actualComponent) {
      console.warn(`[Fromcode] Field component "${name}" resolved to undefined.`);
      return;
    }

    setFieldComponents((prev) => {
      if (prev[name] === actualComponent) {
        return prev;
      }

      return { ...prev, [name]: actualComponent };
    });
  }, []);

  const registerOverride = useCallback((name: string, component: any, pluginSlug?: string, priority?: number) => {
    if (!component) return;

    // Handle CJS/ESM mismatch
    let actualComponent = component;
    if (component && !component.$$typeof && typeof component === 'object' && component.default) {
      actualComponent = component.default;
    }

    const componentObj: SlotComponent = typeof actualComponent === 'function' || (actualComponent && (actualComponent as any).$$typeof)
      ? { component: actualComponent, pluginSlug: pluginSlug || 'unknown', priority: priority || 0 }
      : actualComponent;

    setOverrides((prev) => {
      const existing = prev[name];
      // Only replace if priority is higher
      if (existing && existing.priority >= componentObj.priority) return prev;
      return { ...prev, [name]: componentObj };
    });
  }, []);

  const registerMenuItem = useCallback((item: MenuItem) => {
    setMenuItems((prev) => {
      if (prev.some(m => m.pluginSlug === item.pluginSlug && m.path === item.path)) return prev;
      return [...prev, item].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    });
  }, []);

  const replaceMenuItems = useCallback((items: MenuItem[]) => {
    setMenuItems(
      (Array.isArray(items) ? items : [])
        .slice()
        .sort((a, b) => (a.priority || 0) - (b.priority || 0))
    );
  }, []);

  const registerCollection = useCallback((collection: CollectionMetadata) => {
    setCollections((prev) => {
      if (prev.some(c => c.slug === collection.slug)) return prev;
      return [...prev, collection];
    });
  }, []);

  const replaceCollections = useCallback((items: CollectionMetadata[]) => {
    setCollections(Array.isArray(items) ? items : []);
  }, []);

  const registerPlugins = useCallback((newPlugins: any[]) => {
    setPlugins(newPlugins);
  }, []);

  const registerSettings = useCallback((newSettings: Record<string, any>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const registerTheme = useCallback((slug: string, config: any) => {
    if (config?.variables) {
      setThemeVariables(prev => ({ ...prev, ...config.variables }));
    }
    // Layouts are usually provided as a map: { layoutName: Component }
    if (config?.layouts && !Array.isArray(config.layouts)) {
      setThemeLayouts(prev => ({ ...prev, ...config.layouts }));
    }
    if (config?.overrides) {
      if (Array.isArray(config.overrides)) {
        config.overrides.forEach((o: any) => {
           if (o.name && o.component) {
             registerOverride(o.name, o.component, slug, o.priority || 10);
           }
        });
      } else {
        Object.entries(config.overrides).forEach(([name, component]) => {
          registerOverride(name, component, slug, 10);
        });
      }
    }
  }, [registerOverride]);

  ContextRuntimeBridge.setupGlobalStubs({
    ReactRef: React,
    ReactDOMRef: ReactDOM,
    FrameworkIcons,
    FrameworkIconRegistry,
    getIcon,
    IconNames: iconNames,
    createProxyIcon,
  });

  React.useEffect(() => {
    const Slot = require('./slot').Slot;
    const Override = require('./override').Override;

    ContextRuntimeBridge.installRuntimeBridge({
      apiUrl,
      registerSlotComponent,
      registerFieldComponent,
      registerOverride,
      registerMenuItem,
      replaceMenuItems,
      registerCollection,
      replaceCollections,
      registerPlugins,
      registerTheme,
      registerSettings,
      registerAPI,
      getAPI,
      registerPluginApi,
      getPluginApi,
      hasPluginApi,
      setPluginState,
      stableLoadConfig,
      stableGetFrontendMetadata,
      emit,
      on,
      stableT,
      stableApiBridge,
      setLocale,
      usePlugins: usePluginsBridgeHook,
      useTranslation: useTranslationBridgeHook,
      usePluginAPI: usePluginApiBridgeHook,
      usePluginState: usePluginStateBridgeHook,
      useSystemShortcodes: SystemShortcodes.useSystemShortcodes,
      CollectionQueryUtils,
      BrowserLocalization,
      LocalizationUtils,
      RelationUtils,
      CoercionUtils,
      StringUtils,
      NumberUtils,
      FormatUtils,
      ApiVersionUtils,
      CollectionUtils,
      PaginationUtils,
      HookEventUtils,
      isReady,
      PluginsProvider,
      RuntimeConstants,
      getIcon,
      FrameworkIconRegistry,
      FrameworkIcons,
      IconNames: iconNames,
      createProxyIcon,
      RootFramework,
      Slot,
      Override,
      ReactRef: React,
      ReactDOMRef: ReactDOM,
      runtimeModules,
      stabilityRef,
    });
  }, [registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, replaceMenuItems, registerCollection, replaceCollections, registerPlugins, registerTheme, registerSettings, registerAPI, getAPI, registerPluginApi, getPluginApi, hasPluginApi, setPluginState, stableLoadConfig, stableGetFrontendMetadata, emit, on, stableT, setLocale, stableApiBridge, isReady, runtimeModules, apiUrl]);

  const value = React.useMemo(() => ({
    slots,
    overrides,
    themeVariables,
    themeLayouts,
    activeTheme,
    menuItems,
    collections,
    fieldComponents,
    plugins,
    settings,
    pluginState,
    translations,
    locale,
    refreshVersion,
    isReady,
    triggerRefresh,
    setLocale,
    t,
    emit,
    on,
    registerAPI,
    getAPI,
    registerPluginApi,
    getPluginApi,
    hasPluginApi,
    setPluginState,
    registerSlotComponent,
    registerFieldComponent,
    registerOverride,
    registerMenuItem,
    replaceMenuItems,
    registerCollection,
    replaceCollections,
    registerPlugins,
    registerTheme,
    registerSettings,
    loadConfig,
    getFrontendMetadata,
    resolveContent,
    api
  }), [slots, overrides, themeVariables, themeLayouts, activeTheme, menuItems, collections, fieldComponents, plugins, settings, pluginState, translations, locale, refreshVersion, triggerRefresh, t, emit, on, registerAPI, getAPI, registerPluginApi, getPluginApi, hasPluginApi, setPluginState, registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, replaceMenuItems, registerCollection, replaceCollections, registerPlugins, registerTheme, registerSettings, loadConfig, getFrontendMetadata, resolveContent, api]);

  return (
    <PluginContextRegistry.Context.Provider value={value}>
      {children}
    </PluginContextRegistry.Context.Provider>
  );
};

export class PluginsProvider extends React.Component<PluginsProviderProps> {
  static readonly PluginContext = PluginContextRegistry.Context;

  render(): React.ReactNode {
    return <PluginsProviderInternal {...this.props} />;
  }
}
