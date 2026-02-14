"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Slot } from './slot';
import { Override } from './override';
import { getIcon, FrameworkIconRegistry, createProxyIcon, FrameworkIcons, IconNames } from './icons';
import { RootFramework } from './root-framework';

export interface SlotComponent {
  component: React.ComponentType<any>;
  priority: number;
  pluginSlug: string;
}

export interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  priority?: number;
  pluginSlug: string;
  group?: string;
  children?: MenuItem[];
}

export interface CollectionMetadata {
  slug: string;
  shortSlug?: string;
  unprefixedSlug?: string;
  pluginSlug?: string;
  name?: string;
  fields: any[];
  admin?: any;
}

interface PluginContextValue {
  slots: Record<string, SlotComponent[]>;
  overrides: Record<string, SlotComponent>;
  themeVariables: Record<string, string>;
  themeLayouts: Record<string, any>;
  activeTheme: any;
  menuItems: MenuItem[];
  collections: CollectionMetadata[];
  fieldComponents: Record<string, React.ComponentType<any>>;
  plugins: any[];
  settings: Record<string, any>;
  pluginState: Record<string, Record<string, any>>;
  translations: Record<string, any>;
  locale: string;
  refreshVersion: number;
  triggerRefresh: () => void;
  setLocale: (locale: string) => void;
  t: (key: string, params?: Record<string, any>, defaultValue?: string) => string;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (data: any) => void) => () => void;
  registerAPI: (slug: string, api: any) => void;
  getAPI: (slug: string) => any;
  setPluginState: (pluginSlug: string, key: string, value: any) => void;
  registerSlotComponent: (slotName: string, component: SlotComponent) => void;
  registerFieldComponent: (name: string, component: any) => void;
  registerOverride: (name: string, component: SlotComponent) => void;
  registerMenuItem: (item: MenuItem) => void;
  registerCollection: (collection: CollectionMetadata) => void;
  registerPlugins: (plugins: any[]) => void;
  registerTheme: (slug: string, config: any) => void;
  registerSettings: (settings: Record<string, any>) => void;
  loadConfig: (path?: string) => Promise<void>;
  resolveContent: (slug: string) => Promise<{ type: string, doc: any, plugin: string } | null>;
  api: {
    get: (path: string, options?: any) => Promise<any>;
    post: (path: string, body?: any, options?: any) => Promise<any>;
    put: (path: string, body?: any, options?: any) => Promise<any>;
    patch: (path: string, body?: any, options?: any) => Promise<any>;
    delete: (path: string, options?: any) => Promise<any>;
  };
}

const PluginContext = createContext<PluginContextValue | null>(null);

// --- Standalone Bridge Exports ---
// These allow plugins to import { registerX } from '@fromcode/react' 
// when running inside the framework's dynamic bridge environment.

const getBridge = () => (typeof window !== 'undefined' ? (window as any).Fromcode : {});

export const registerSlotComponent = (...args: any[]) => getBridge().registerSlotComponent?.(...args);
export const registerFieldComponent = (...args: any[]) => getBridge().registerFieldComponent?.(...args);
export const registerOverride = (...args: any[]) => getBridge().registerOverride?.(...args);
export const registerMenuItem = (...args: any[]) => getBridge().registerMenuItem?.(...args);
export const registerCollection = (...args: any[]) => getBridge().registerCollection?.(...args);
export const registerPlugins = (...args: any[]) => getBridge().registerPlugins?.(...args);
export const registerTheme = (...args: any[]) => getBridge().registerTheme?.(...args);
export const registerSettings = (...args: any[]) => getBridge().registerSettings?.(...args);
export const registerAPI = (...args: any[]) => getBridge().registerAPI?.(...args);
export const getAPI = (...args: any[]) => getBridge().getAPI?.(...args);
export const setPluginState = (...args: any[]) => getBridge().setPluginState?.(...args);
export const loadConfig = (...args: any[]) => getBridge().loadConfig?.(...args);
export const resolveContent = (...args: any[]) => getBridge().resolveContent?.(...args);
export const emit = (...args: any[]) => getBridge().emit?.(...args);
export const on = (...args: any[]) => getBridge().on?.(...args);
export const t = (...args: any[]) => getBridge().t?.(...args);
export const locale = typeof window !== 'undefined' ? (window as any).Fromcode?.locale : 'en';
export const setLocale = (...args: any[]) => getBridge().setLocale?.(...args);
export const api = {
  getBaseUrl: (...args: any[]) => getBridge().api?.getBaseUrl?.(...args),
  get: (...args: any[]) => getBridge().api?.get?.(...args),
  post: (...args: any[]) => getBridge().api?.post?.(...args),
  put: (...args: any[]) => getBridge().api?.put?.(...args),
  patch: (...args: any[]) => getBridge().api?.patch?.(...args),
  delete: (...args: any[]) => getBridge().api?.delete?.(...args),
};

export const PluginsProvider = ({ children, apiUrl, runtimeModules }: { children: ReactNode, apiUrl?: string, runtimeModules?: Record<string, any> }) => {
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
  const [pluginAPIs] = useState<Record<string, any>>({});
  const [events] = useState(() => new Map<string, Set<(data: any) => void>>());
  const [serverRuntimeModules, setServerRuntimeModules] = useState<Record<string, any>>({});
  
  const getBaseURL = useCallback(() => {
    const bridgeUrl = typeof window !== 'undefined' ? (window as any).FROMCODE_API_URL : '';
    let effectiveApiUrl = apiUrl || bridgeUrl || 'http://api.framework.local';
    
    if (!effectiveApiUrl.startsWith('http') && !effectiveApiUrl.startsWith('/')) {
      effectiveApiUrl = `http://${effectiveApiUrl}`;
    }
    
    return effectiveApiUrl.endsWith('/') ? effectiveApiUrl.slice(0, -1) : effectiveApiUrl;
  }, [apiUrl]);

  const apiFetch = useCallback(async (path: string, options: (RequestInit & { silent?: boolean }) = {}) => {
    const { silent, ...fetchOptions } = options as any;
    const base = getBaseURL();
    const version = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_VERSION) || 'v1';
    
    let url = path;
    if (!path.startsWith('http')) {
      const vPrefix = `/api/${version}`;
      // Prevent double prefixing if path already starts with /api/v1
      const relativePath = path.startsWith(vPrefix) ? path.slice(vPrefix.length) : path;
      url = `${base}${vPrefix}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
    }
    
    const token = typeof document !== 'undefined' 
      ? document.cookie.split('; ').find(row => row.startsWith('fc_token='))?.split('=')[1]
      : null;

    if (!silent) {
      console.debug(`[Fromcode API] Fetching: ${url}`, { credentials: fetchOptions.credentials || 'include', hasToken: !!token });
    }

    const res = await fetch(url, {
      ...fetchOptions,
      credentials: fetchOptions.credentials || 'include',
      headers: {
        ...(fetchOptions.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    if (!res.ok) {
        if (res.status === 404 && url.includes('/system/resolve')) {
          return null;
        }
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        if (!silent) {
          console.error(`[Fromcode API] Error ${res.status} from ${url}:`, err);
        }
        throw new Error(err.error || `Failed to fetch from ${url}`);
    }
    return res.json();
  }, [getBaseURL]);

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
          
          if (params.get('preview') === '1') query += '&preview=1';
          if (params.get('draft') === '1') query += '&draft=1';
          
          // Also check if we are in an iframe (preview mode often uses iframes)
          if (window.self !== window.top) {
             query += '&preview=1';
          }
        }
        const result = await api.get(`/system/resolve${query}`, { silent: true });
        return result;
    } catch (e) {
        return null;
    }
  }, [api, locale, settings?.default_locale, settings?.frontend_default_locale, settings?.fallback_locale]);

  const loadConfig = useCallback(async (path: string = '/system/frontend') => {
    try {
      const base = getBaseURL();
      const version = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_VERSION) || 'v1';
      
      // Handle paths that might already be versioned (/api/v1/...)
      let endpoint = path;
      if (!path.startsWith('http')) {
        const relativePath = path.startsWith(`/api/${version}`) 
          ? path.replace(`/api/${version}`, '') 
          : path;
        endpoint = `${base}/api/${version}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
      }
      
      console.debug(`[Fromcode] Loading config from: ${endpoint}`);

      const token = typeof document !== 'undefined' 
        ? document.cookie.split('; ').find(row => row.startsWith('fc_token='))?.split('=')[1]
        : null;

      const res = await fetch(endpoint, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      
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

        // Load Theme JS Bundle (Entry)
        if (theme.ui?.entry) {
          const entryUrl = theme.ui.entry.startsWith('http') ? theme.ui.entry : `${baseThemeUrl}/ui/${theme.ui.entry}`;
          if (!document.querySelector(`script[src="${entryUrl}"]`)) {
            const script = document.createElement('script');
            script.src = entryUrl;
            script.type = 'module';
            script.async = true;
            document.head.appendChild(script);
          }
        }
      }
    } catch (err) {
      console.warn("[Fromcode] Failed to load config:", err);
    }
  }, [apiUrl, getBaseURL]);

  const registerAPI = useCallback((slug: string, api: any) => {
    pluginAPIs[slug] = api;
  }, [pluginAPIs]);

  const getAPI = useCallback((slug: string) => {
    return pluginAPIs[slug];
  }, [pluginAPIs]);

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
      const currentApiUrl = (stabilityRef.current as any).apiUrl;
      const bridgeUrl = typeof window !== 'undefined' ? (window as any).FROMCODE_API_URL : '';
      let effectiveApiUrl = currentApiUrl || bridgeUrl || 'http://api.framework.local';
      
      // Ensure effectiveApiUrl is absolute or properly handled
      if (!effectiveApiUrl.startsWith('http') && !effectiveApiUrl.startsWith('/')) {
        effectiveApiUrl = `http://${effectiveApiUrl}`;
      }
      
      // Clean up trailing slash
      const base = effectiveApiUrl.endsWith('/') ? effectiveApiUrl.slice(0, -1) : effectiveApiUrl;
      const apiVersion = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_VERSION) || 'v1';
      const endpoint = `${base}/api/${apiVersion}/system/i18n?locale=${newLocale}`;
      
      const res = await fetch(endpoint, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
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
    fieldComponents, plugins, settings, translations, locale, refreshVersion, 
    triggerRefresh, api, resolveContent, getAPI, setLocale, t, emit, on,
    loadConfig, serverRuntimeModules, runtimeModules, apiUrl
  });

  React.useEffect(() => {
    stabilityRef.current = {
      slots, overrides, themeVariables, themeLayouts, activeTheme, menuItems, collections, 
      fieldComponents, plugins, settings, translations, locale, refreshVersion, 
      triggerRefresh, api, resolveContent, getAPI, setLocale, t, emit, on,
      loadConfig, serverRuntimeModules, runtimeModules, apiUrl
    };
  }, [slots, overrides, themeVariables, themeLayouts, activeTheme, menuItems, collections, fieldComponents, plugins, settings, translations, locale, refreshVersion, triggerRefresh, api, resolveContent, getAPI, setLocale, t, emit, on, loadConfig, serverRuntimeModules, runtimeModules, apiUrl]);

  // NEW: Stable bridge wrappers to prevent re-injection loops for functions with volatile dependencies
  const stableT = useCallback((...args: any[]) => (stabilityRef.current.t as any)(...args), []);
  const stableLoadConfig = useCallback((...args: any[]) => (stabilityRef.current.loadConfig as any)(...args), []);

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

    const componentObj: SlotComponent = typeof actualComponent === 'function' || (actualComponent && (actualComponent as any).$$typeof)
      ? { component: actualComponent, pluginSlug: pluginSlug || 'unknown', priority: priority || 0 }
      : actualComponent;

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

    console.log(`[Fromcode] Registering field component: ${name}`);
    setFieldComponents(prev => ({ ...prev, [name]: actualComponent }));
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

  const registerCollection = useCallback((collection: CollectionMetadata) => {
    setCollections((prev) => {
      if (prev.some(c => c.slug === collection.slug)) return prev;
      return [...prev, collection];
    });
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

  // Set up global bridge for dynamic plugins
  if (typeof window !== 'undefined') {
    if (!(window as any).Fromcode) {
      (window as any).Fromcode = {};
    }

    if (!(window as any).FromcodeAdmin) {
      (window as any).FromcodeAdmin = {};
    }
    
    const fc = (window as any).Fromcode;
    fc.React = React;
    fc.ReactDOM = ReactDOM;
    fc.ReactDom = ReactDOM; // Compatibility

    (window as any).React = React;
    (window as any).ReactDOM = ReactDOM;
    (window as any).ReactDom = ReactDOM;
    (window as any).FrameworkIcons = FrameworkIcons;
    (window as any).FrameworkIconRegistry = FrameworkIconRegistry;

    const queueMethod = (type: string) => (...args: any[]) => {
      console.log(`[Fromcode] Queuing method: ${type}`, args);
      if (!(window as any)._fromcodeQueue) (window as any)._fromcodeQueue = [];
      (window as any)._fromcodeQueue.push({ type, args });
    };

    if (!fc.registerSlotComponent) fc.registerSlotComponent = queueMethod('slot');
    if (!fc.registerFieldComponent) fc.registerFieldComponent = queueMethod('field');
    if (!fc.registerOverride) fc.registerOverride = queueMethod('override');
    if (!fc.registerMenuItem) fc.registerMenuItem = queueMethod('menuItem');
    if (!fc.registerCollection) fc.registerCollection = queueMethod('collection');
    if (!fc.registerTheme) fc.registerTheme = queueMethod('theme');
    if (!fc.registerSettings) fc.registerSettings = queueMethod('settings');
    
    if (!fc.t) fc.t = (key: string, _params?: any, defaultValue?: string) => defaultValue || key;
    if (!fc.locale) fc.locale = 'en';

    // Immediate population of icon symbols to prevent import race conditions
    fc.getIcon = getIcon;
    fc.FrameworkIcons = FrameworkIcons;
    (window as any).FrameworkIcons = FrameworkIcons;
    fc.FrameworkIconRegistry = FrameworkIconRegistry;
    fc.IconNames = IconNames;
    fc.createProxyIcon = createProxyIcon;
  }

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (apiUrl) (window as any).FROMCODE_API_URL = apiUrl;
      
      const bridge = {
        React: React,
        ReactDOM: ReactDOM,
        ReactDom: ReactDOM,
        Slot,
        Override,
        getIcon,
        IconRegistry: FrameworkIconRegistry,
        FrameworkIconRegistry,
        FrameworkIcons,
        IconNames,
        createProxyIcon,
        RootFramework,
        // Map Lucide names to their framework equivalents or direct proxies
        Loader2: getIcon('Loader2'),
        Search: getIcon('Search'),
        Plus: getIcon('Plus'),
        Trash2: getIcon('Trash'),
        Pencil: getIcon('Edit'),
        Save: getIcon('Save'),
        Download: getIcon('Download'),
        Upload: getIcon('Upload'),
        RefreshCw: getIcon('Refresh'),
        ExternalLink: getIcon('External'),
        MoreHorizontal: getIcon('More'),
        Filter: getIcon('Filter'),
        FileText: getIcon('FileText'),
        Tag: getIcon('Tag'),
        Layers: getIcon('Layers'),
        ChevronDown: getIcon('Down'),
        ChevronRight: getIcon('Right'),
        Home: getIcon('Home'),
        Info: getIcon('Info'),
        AlertCircle: getIcon('Alert'),
        CheckCircle2: getIcon('Check'),
        MoreVertical: getIcon('MoreVertical'),
        Layout: getIcon('Layout'),
        Columns: getIcon('Columns'),
        Copy: getIcon('Copy'),
        Settings: getIcon('settings'),
        BarChart3: getIcon('BarChart3'),
        PlusCircle: getIcon('PlusCircle'),
        File: getIcon('File'),
        Film: getIcon('Film'),
        registerSlotComponent,
        registerFieldComponent,
        registerOverride,
        registerMenuItem,
        registerCollection,
        registerPlugins,
        registerTheme,
        registerSettings,
        registerAPI,
        getAPI,
        setPluginState,
        loadConfig: stableLoadConfig,
        emit,
        on,
        t: stableT,
        api: stableApiBridge,
        locale,
        setLocale,
        usePlugins,
        useTranslation,
        usePluginAPI,
        usePluginState,
        isReady: true,
        // Non-hook versions for direct access from CJS/ESM bridge
        getState: () => stabilityRef.current,
        PluginsProvider
      };

      (window as any).Fromcode = bridge;
      (window as any).getIcon = getIcon;
      (window as any).FrameworkIcons = FrameworkIcons;
      (window as any).FrameworkIconRegistry = FrameworkIconRegistry;
      (window as any).React = React;
      (window as any).ReactDOM = ReactDOM;
      (window as any).ReactDom = ReactDOM;

      // --- Consolidated Runtime Import Map Generation ---
      const imports: Record<string, string> = {
          "react": "data:application/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext, useReducer, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, memo, lazy, Suspense, createElement, cloneElement, isValidElement, startTransition, useTransition, useDeferredValue, useId, Children, Fragment, StrictMode, Profiler, Component, PureComponent } = window.React;",
          "react-dom": "data:application/javascript,export default window.ReactDOM; export const { render, hydrate, findDOMNode, unmountComponentAtNode, createPortal, flushSync, createRoot } = window.ReactDOM;",
          "react/jsx-runtime": "data:application/javascript,export const jsx = window.React.createElement; export const jsxs = window.React.createElement; export const Fragment = window.React.Fragment; export default { jsx, jsxs, Fragment };",
          "react/jsx-dev-runtime": "data:application/javascript,export const jsxDEV = window.React.createElement; export const Fragment = window.React.Fragment; export default { jsxDEV, Fragment };",
          "lucide-react": "data:application/javascript," + encodeURIComponent(
            Object.keys((window as any).Lucide || (window as any).FrameworkIcons || {}).map(key => `export const ${key} = (window.Lucide || window.FrameworkIcons).${key};`).join('\n') + `\nexport default (window.Lucide || window.FrameworkIcons);`
          ),
          "@fromcode/react": "data:application/javascript," + encodeURIComponent(
            Object.keys(bridge).filter(k => typeof (bridge as any)[k] === 'function' || k === 'api' || ((bridge as any)[k] && (bridge as any)[k].$$typeof)).map(key => `export const ${key} = window.Fromcode.${key};`).join('\n') + `\nexport default window.Fromcode;`
          ),
          "@fromcode/admin/components": "data:application/javascript," + encodeURIComponent(
            ['MediaPicker', 'Button', 'Input', 'Select', 'TagField', 'Loader', 'Switch', 'Card', 'Badge', 'ConfirmDialog', 'PromptDialog', 'DateTimePicker', 'ColorPicker', 'CodeEditor', 'VisualMenuField', 'Icon', 'ThemeContext', 'NotificationContext']
              .map(key => `export const ${key} = window.FromcodeAdmin ? window.FromcodeAdmin.${key} : undefined;`).join('\n') + `\nexport default window.FromcodeAdmin;`
          )
      };

      // Merge server-side and client-side modules from stabilityRef
      const currentServerModules = stabilityRef.current.serverRuntimeModules;
      const currentClientModules = stabilityRef.current.runtimeModules;

      if (currentServerModules) {
        const base = (stabilityRef.current as any).apiUrl || (window as any).FROMCODE_API_URL || '';
        Object.entries(currentServerModules).forEach(([name, config]: [string, any]) => {
          if (config.url) {
            imports[name] = config.url.startsWith('/') ? `${base}${config.url}` : config.url;
          } else if (config.source) {
            imports[name] = `data:application/javascript;base64,${config.source}`;
          }
        });
      }

      if (currentClientModules) {
          Object.entries(currentClientModules).forEach(([name, mod]) => {
              const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
              (window as any)[`_fc_mod_${safeName}`] = mod;
              const keys = Object.keys(mod);
              imports[name] = "data:application/javascript," + encodeURIComponent(
                  keys.map(key => `export const ${key} = window._fc_mod_${safeName}.${key};`).join('\n') + `\nexport default window._fc_mod_${safeName};`
              );
          });
      }

      let script = document.getElementById('fc-runtime-import-map') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = 'fc-runtime-import-map';
        script.type = 'importmap';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify({ imports });
      // --------------------------------------------------

      // Flush queue
      if ((window as any)._fromcodeQueue) {
        console.log(`[Fromcode] Flushing queue with ${(window as any)._fromcodeQueue.length} items`);
        const queue = (window as any)._fromcodeQueue;
        delete (window as any)._fromcodeQueue;

        queue.forEach((item: any) => {
          try {
            console.log(`[Fromcode] Processing queued item: ${item.type}`, item.args);
            switch (item.type) {
              case 'slot': (registerSlotComponent as any)(...(item.args || [item.name, item.comp])); break;
              case 'field': (registerFieldComponent as any)(...(item.args || [item.name, item.component])); break;
              case 'override': (registerOverride as any)(...(item.args || [item.name, item.component])); break;
              case 'menuItem': (registerMenuItem as any)(...(item.args || [item.item])); break;
              case 'collection': (registerCollection as any)(...(item.args || [item.collection])); break;
              case 'theme': (registerTheme as any)(...(item.args || [item.slug, item.config])); break;
              case 'settings': (registerSettings as any)(...(item.args || [item.settings])); break;
            }
          } catch (e) {
            console.error(`[Fromcode] Failed to flush queued item of type ${item.type}:`, e);
          }
        });
      }
    }
  }, [registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, registerCollection, registerPlugins, registerTheme, registerSettings, registerAPI, getAPI, setPluginState, stableLoadConfig, emit, on, stableT, locale, setLocale, triggerRefresh, stableApiBridge]);

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
    triggerRefresh,
    setLocale,
    t,
    emit,
    on,
    registerAPI,
    getAPI,
    setPluginState,
    registerSlotComponent,
    registerFieldComponent,
    registerOverride,
    registerMenuItem,
    registerCollection,
    registerPlugins,
    registerTheme,
    registerSettings,
    loadConfig,
    resolveContent,
    api
  }), [slots, overrides, themeVariables, themeLayouts, activeTheme, menuItems, collections, fieldComponents, plugins, settings, pluginState, translations, locale, refreshVersion, triggerRefresh, t, emit, on, registerAPI, getAPI, setPluginState, registerSlotComponent, registerFieldComponent, registerOverride, registerMenuItem, registerCollection, registerPlugins, registerTheme, registerSettings, loadConfig, resolveContent, api]);

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
};

export const usePlugins = () => {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugins must be used within a PluginsProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { t, locale, setLocale } = usePlugins();
  return { t, locale, setLocale };
};

export const usePluginAPI = (slug: string) => {
  const { api } = usePlugins();
  
  return useMemo(() => ({
    get: (path: string, options?: any) => 
      api.get(`/${slug}${path.startsWith('/') ? '' : '/'}${path}`, options),
    post: (path: string, body?: any, options?: any) => 
      api.post(`/${slug}${path.startsWith('/') ? '' : '/'}${path}`, body, options),
    put: (path: string, body?: any, options?: any) => 
      api.put(`/${slug}${path.startsWith('/') ? '' : '/'}${path}`, body, options),
    delete: (path: string, options?: any) => 
      api.delete(`/${slug}${path.startsWith('/') ? '' : '/'}${path}`, options),
    patch: (path: string, body?: any, options?: any) => 
      api.patch(`/${slug}${path.startsWith('/') ? '' : '/'}${path}`, body, options),
  }), [api, slug]);
};

export const usePluginState = (pluginSlug: string, key?: string) => {
  const { pluginState, setPluginState } = usePlugins();
  const state = pluginState[pluginSlug] || {};
  
  const setter = useCallback((value: any) => {
    if (key) {
      setPluginState(pluginSlug, key, value);
    } else {
      // If no key, assume we are setting the whole namespaced object
      Object.entries(value).forEach(([k, v]) => {
        setPluginState(pluginSlug, k, v);
      });
    }
  }, [pluginSlug, key, setPluginState]);

  if (key) {
    return [state[key], setter] as const;
  }

  return [state, setter] as const;
};
