"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Slot } from './Slot';
import { Override } from './Override';

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
  name?: string;
  fields: any[];
  admin?: any;
}

interface PluginContextValue {
  slots: Record<string, SlotComponent[]>;
  overrides: Record<string, SlotComponent>;
  themeVariables: Record<string, string>;
  menuItems: MenuItem[];
  collections: CollectionMetadata[];
  translations: Record<string, any>;
  locale: string;
  refreshVersion: number;
  triggerRefresh: () => void;
  setLocale: (locale: string) => void;
  t: (key: string, params?: Record<string, any>) => string;
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
}

const PluginContext = createContext<PluginContextValue | null>(null);

export const PluginsProvider = ({ children, apiUrl }: { children: ReactNode, apiUrl?: string }) => {
  const [slots, setSlots] = useState<Record<string, SlotComponent[]>>({});
  const [overrides, setOverrides] = useState<Record<string, SlotComponent>>({});
  const [themeVariables, setThemeVariables] = useState<Record<string, string>>({});
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [collections, setCollections] = useState<CollectionMetadata[]>([]);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [locale, setLocale] = useState<string>('en');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [pluginAPIs] = useState<Record<string, any>>({});
  const [events] = useState(() => new Map<string, Set<(data: any) => void>>());

  const loadFrontendConfig = useCallback(async () => {
    try {
      const bridgeUrl = typeof window !== 'undefined' ? (window as any).FROMCODE_API_URL : '';
      let effectiveApiUrl = apiUrl || bridgeUrl || 'http://api.fromcode.local';
      
      if (!effectiveApiUrl.startsWith('http') && !effectiveApiUrl.startsWith('/')) {
        effectiveApiUrl = `http://${effectiveApiUrl}`;
      }
      
      const base = effectiveApiUrl.endsWith('/') ? effectiveApiUrl.slice(0, -1) : effectiveApiUrl;
      const apiVersion = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_VERSION) || 'v1';
      const endpoint = `${base}/api/${apiVersion}/system/frontend`;
      
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      
      if (data.activeTheme) {
        setThemeVariables(data.activeTheme.variables || {});
        // Process overrides if they provide a component reference string or if we load them dynamically
        // For now, variables is the main focus for "themes"
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

  const t = useCallback((key: string, params: Record<string, any> = {}) => {
    let value: any = translations;
    const parts = key.split('.');
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return key;
      }
    }

    if (typeof value !== 'string') return key;

    return value.replace(/\{\{(.+?)\}\}/g, (_, match) => {
      const paramKey = match.trim();
      return params[paramKey] !== undefined ? String(params[paramKey]) : `{{${paramKey}}}`;
    });
  }, [translations]);

  const registerSlotComponent = useCallback((slotName: string, component: SlotComponent) => {
    setSlots((prev) => {
      const existing = prev[slotName] || [];
      const isAlreadyRegistered = existing.some(
        (item) => item.pluginSlug === component.pluginSlug && 
                  (item.component === component.component)
      );
      if (isAlreadyRegistered) return prev;
      return { 
        ...prev, 
        [slotName]: [...existing, component].sort((a, b) => a.priority - b.priority) 
      };
    });
  }, []);

  const registerOverride = useCallback((name: string, component: SlotComponent) => {
    setOverrides((prev) => {
      const existing = prev[name];
      // Only replace if priority is higher
      if (existing && existing.priority >= component.priority) return prev;
      return { ...prev, [name]: component };
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
  }, []);

  // Set up global bridge for dynamic plugins
  if (typeof window !== 'undefined') {
    if (!(window as any).Fromcode) {
      (window as any).Fromcode = {};
    }
    
    const fc = (window as any).Fromcode;
    fc.React = React;

    const queueMethod = (type: string) => (...args: any[]) => {
      if (!(window as any)._fromcodeQueue) (window as any)._fromcodeQueue = [];
      (window as any)._fromcodeQueue.push({ type, args });
    };

    if (!fc.registerSlotComponent) fc.registerSlotComponent = queueMethod('slot');
    if (!fc.registerOverride) fc.registerOverride = queueMethod('override');
    if (!fc.registerMenuItem) fc.registerMenuItem = queueMethod('menuItem');
    if (!fc.registerCollection) fc.registerCollection = queueMethod('collection');
    if (!fc.registerTheme) fc.registerTheme = queueMethod('theme');
    
    if (!fc.t) fc.t = (key: string) => key;
    if (!fc.locale) fc.locale = 'en';
  }

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (apiUrl) (window as any).FROMCODE_API_URL = apiUrl;
      (window as any).React = React;
      
      const bridge = {
        React: React,
        Slot,
        Override,
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
        locale
      };

      (window as any).Fromcode = bridge;

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
    loadFrontendConfig
  }), [slots, overrides, themeVariables, menuItems, collections, translations, locale, refreshVersion, triggerRefresh, t, emit, on, registerAPI, getAPI, registerSlotComponent, registerOverride, registerMenuItem, registerCollection, registerTheme, loadFrontendConfig]);

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
