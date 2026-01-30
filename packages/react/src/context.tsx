"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Slot } from './Slot';
import { Override } from './Override';
import { getIcon } from './Icons';

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
  menuItems: MenuItem[];
  collections: CollectionMetadata[];
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
  registerSlotComponent: (slotName: string, component: SlotComponent) => void;
  registerOverride: (name: string, component: SlotComponent) => void;
  registerMenuItem: (item: MenuItem) => void;
  registerCollection: (collection: CollectionMetadata) => void;
  registerTheme: (slug: string, config: any) => void;
  loadFrontendConfig: () => Promise<void>;
  resolveContent: (slug: string) => Promise<{ type: string, doc: any, plugin: string } | null>;
  api: {
    get: (path: string, options?: any) => Promise<any>;
    post: (path: string, body?: any, options?: any) => Promise<any>;
  };
}

const PluginContext = createContext<PluginContextValue | null>(null);

export const PluginsProvider = ({ children, apiUrl }: { children: ReactNode, apiUrl?: string }) => {
  const [slots, setSlots] = useState<Record<string, SlotComponent[]>>({});
  const [overrides, setOverrides] = useState<Record<string, SlotComponent>>({});
  const [themeVariables, setThemeVariables] = useState<Record<string, string>>({});
  const [themeLayouts, setThemeLayouts] = useState<Record<string, any>>({});
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [collections, setCollections] = useState<CollectionMetadata[]>([]);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [locale, setLocale] = useState<string>('en');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [pluginAPIs] = useState<Record<string, any>>({});
  const [events] = useState(() => new Map<string, Set<(data: any) => void>>());

  const getBaseURL = useCallback(() => {
    const bridgeUrl = typeof window !== 'undefined' ? (window as any).FROMCODE_API_URL : '';
    let effectiveApiUrl = apiUrl || bridgeUrl || 'http://api.fromcode.local';
    
    if (!effectiveApiUrl.startsWith('http') && !effectiveApiUrl.startsWith('/')) {
      effectiveApiUrl = `http://${effectiveApiUrl}`;
    }
    
    return effectiveApiUrl.endsWith('/') ? effectiveApiUrl.slice(0, -1) : effectiveApiUrl;
  }, [apiUrl]);

  const apiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    const base = getBaseURL();
    const version = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_VERSION) || 'v1';
    
    const url = path.startsWith('http') ? path : `${base}/api/${version}${path.startsWith('/') ? '' : '/'}${path}`;
    
    const res = await fetch(url, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Failed to fetch from ${url}`);
    }
    return res.json();
  }, [getBaseURL]);

  const api = useMemo(() => ({
    get: (path: string, options?: any) => apiFetch(path, { ...options, method: 'GET' }),
    post: (path: string, body?: any, options?: any) => apiFetch(path, { 
        ...options, 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
        body: JSON.stringify(body)
    }),
  }), [apiFetch]);

  const resolveContent = useCallback(async (slug: string) => {
    try {
        const result = await api.get(`/system/resolve?slug=${encodeURIComponent(slug)}`);
        return result;
    } catch (e) {
        return null;
    }
  }, [api]);

  const loadFrontendConfig = useCallback(async () => {
    try {
      const base = getBaseURL();
      const version = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_VERSION) || 'v1';
      const endpoint = `${base}/api/${version}/system/frontend`;
      
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      
      // Inject Import Map for React modules to ensure plugins use the host's React
      if (typeof document !== 'undefined' && !document.querySelector('script[type="importmap"]')) {
        const importMap = {
          imports: {
            "react": "data:text/javascript,export default window.React; export const { useState, useEffect, useMemo, useCallback, useContext, createContext, useRef, useLayoutEffect, useImperativeHandle, useDebugValue, forwardRef, version } = window.React;",
            "react-dom": "data:text/javascript,export default window.ReactDom; export const { render, hydrate, createRoot } = window.ReactDom || {};",
            "@fromcode/react": "data:text/javascript,export const { Slot, Override, usePlugins, useTranslation, PluginsProvider, getIcon, createProxyIcon } = window.Fromcode;",
            "react/jsx-runtime": "data:text/javascript,export const jsx = window.React.createElement; export const jsxs = window.React.createElement; export const Fragment = window.React.Fragment;",
            "lucide-react": "data:text/javascript,const proxy = (name) => (props) => { const Component = (window.FrameworkIcons && window.FrameworkIcons[name]) || (window.Fromcode && window.Fromcode[name]); return Component ? window.React.createElement(Component, props) : null; }; export const Loader2 = proxy('Loader2'); export const Search = proxy('Search'); export const Plus = proxy('Plus'); export const Trash2 = proxy('Trash2'); export const Pencil = proxy('Pencil'); export const Save = proxy('Save'); export const Download = proxy('Download'); export const Upload = proxy('Upload'); export const RefreshCw = proxy('RefreshCw'); export const ExternalLink = proxy('ExternalLink'); export const MoreHorizontal = proxy('MoreHorizontal'); export const Filter = proxy('Filter'); export const FileText = proxy('FileText'); export const Tag = proxy('Tag'); export const Layers = proxy('Layers'); export const ChevronDown = proxy('ChevronDown'); export const ChevronRight = proxy('ChevronRight'); export const Home = proxy('Home'); export const Info = proxy('Info'); export const AlertCircle = proxy('AlertCircle'); export const CheckCircle2 = proxy('CheckCircle2'); export const MoreVertical = proxy('MoreVertical'); export const Layout = proxy('Layout'); export const Columns = proxy('Columns'); export const Copy = proxy('Copy'); export const Settings = proxy('Settings'); export const BarChart3 = proxy('BarChart3'); export const PlusCircle = proxy('PlusCircle'); export default new Proxy({}, { get: (_, name) => proxy(name) });"
          }
        };
        const script = document.createElement('script');
        script.type = 'importmap';
        script.textContent = JSON.stringify(importMap);
        document.head.prepend(script);
      }

      if (data.activeTheme) {
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
      console.warn("[Theme] Failed to load frontend config:", err);
    }
  }, [apiUrl]);

  const registerAPI = useCallback((slug: string, api: any) => {
    pluginAPIs[slug] = api;
  }, [pluginAPIs]);

  const getAPI = useCallback((slug: string) => {
    return pluginAPIs[slug];
  }, [pluginAPIs]);

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

  const triggerRefresh = useCallback(() => {
    setRefreshVersion(v => v + 1);
    // Clear slots and menu items so they can be re-registered
    setSlots({});
    setOverrides({});
    setMenuItems([]);
    setCollections([]);
  }, []);

  // Helper to load translations
  const loadTranslations = useCallback(async (newLocale: string) => {
    try {
      const bridgeUrl = typeof window !== 'undefined' ? (window as any).FROMCODE_API_URL : '';
      let effectiveApiUrl = apiUrl || bridgeUrl || 'http://api.fromcode.local';
      
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
  }, [apiUrl]);

  React.useEffect(() => {
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
      const isAlreadyRegistered = existing.some(
        (item) => item.pluginSlug === componentObj.pluginSlug && 
                  (item.component === componentObj.component)
      );
      if (isAlreadyRegistered) return prev;
      return { 
        ...prev, 
        [slotName]: [...existing, componentObj].sort((a, b) => a.priority - b.priority) 
      };
    });
  }, []);

  const registerOverride = useCallback((name: string, component: any, pluginSlug?: string, priority?: number) => {
    const componentObj: SlotComponent = typeof component === 'function' || (component && component.$$typeof)
      ? { component, pluginSlug: pluginSlug || 'unknown', priority: priority || 0 }
      : component;

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

  const registerTheme = useCallback((slug: string, config: any) => {
    if (config?.variables) {
      setThemeVariables(prev => ({ ...prev, ...config.variables }));
    }
    if (config?.layouts) {
      setThemeLayouts(prev => ({ ...prev, ...config.layouts }));
    }
  }, []);

  // Set up global bridge for dynamic plugins
  if (typeof window !== 'undefined') {
    if (!(window as any).Fromcode) {
      (window as any).Fromcode = {};
    }
    
    const fc = (window as any).Fromcode;
    fc.React = React;
    fc.ReactDOM = ReactDOM;
    fc.ReactDom = ReactDOM; // Compatibility

    const queueMethod = (type: string) => (...args: any[]) => {
      if (!(window as any)._fromcodeQueue) (window as any)._fromcodeQueue = [];
      (window as any)._fromcodeQueue.push({ type, args });
    };

    if (!fc.registerSlotComponent) fc.registerSlotComponent = queueMethod('slot');
    if (!fc.registerOverride) fc.registerOverride = queueMethod('override');
    if (!fc.registerMenuItem) fc.registerMenuItem = queueMethod('menuItem');
    if (!fc.registerCollection) fc.registerCollection = queueMethod('collection');
    if (!fc.registerTheme) fc.registerTheme = queueMethod('theme');
    
    if (!fc.t) fc.t = (key: string, _params?: any, defaultValue?: string) => defaultValue || key;
    if (!fc.locale) fc.locale = 'en';
    if (!fc.getIcon) fc.getIcon = getIcon;
  }

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (apiUrl) (window as any).FROMCODE_API_URL = apiUrl;
      (window as any).React = React;
      (window as any).ReactDOM = ReactDOM;
      (window as any).ReactDom = ReactDOM; // Consistency
      
      const bridge = {
        React: React,
        ReactDOM: ReactDOM,
        ReactDom: ReactDOM,
        Slot,
        Override,
        getIcon,
        createProxyIcon: (window as any).Fromcode?.createProxyIcon || (() => null),
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
        Settings: getIcon('Settings'),
        BarChart3: getIcon('BarChart3'),
        PlusCircle: getIcon('PlusCircle'),
        registerSlotComponent,
        registerOverride,
        registerMenuItem,
        registerCollection,
        registerTheme,
        registerAPI,
        getAPI,
        emit,
        on,
        t,
        locale,
        usePlugins,
        useTranslation,
        PluginsProvider
      };

      (window as any).Fromcode = bridge;
      (window as any).getIcon = getIcon;

      // Flush queue
      if ((window as any)._fromcodeQueue) {
        const queue = (window as any)._fromcodeQueue;
        delete (window as any)._fromcodeQueue; // Clear it before processing to avoid loops

        queue.forEach((item: any) => {
          try {
            switch (item.type) {
              case 'slot': (registerSlotComponent as any)(...(item.args || [item.name, item.comp])); break;
              case 'override': (registerOverride as any)(...(item.args || [item.name, item.component])); break;
              case 'menuItem': (registerMenuItem as any)(...(item.args || [item.item])); break;
              case 'collection': (registerCollection as any)(...(item.args || [item.collection])); break;
              case 'theme': (registerTheme as any)(...(item.args || [item.slug, item.config])); break;
            }
          } catch (e) {
            console.error(`[Fromcode] Failed to flush queued item of type ${item.type}:`, e);
          }
        });
      }
    }
  }, [apiUrl, registerSlotComponent, registerOverride, registerMenuItem, registerCollection, registerTheme, emit, on, registerAPI, getAPI, t, locale]);

  const value = React.useMemo(() => ({
    slots,
    overrides,
    themeVariables,
    themeLayouts,
    menuItems,
    collections,
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
    registerSlotComponent,
    registerOverride,
    registerMenuItem,
    registerCollection,
    registerTheme,
    loadFrontendConfig,
    resolveContent,
    api
  }), [slots, overrides, themeVariables, themeLayouts, menuItems, collections, translations, locale, refreshVersion, triggerRefresh, t, emit, on, registerAPI, getAPI, registerSlotComponent, registerOverride, registerMenuItem, registerCollection, registerTheme, loadFrontendConfig, resolveContent, api]);

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
