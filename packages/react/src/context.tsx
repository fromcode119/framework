"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

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
  registerMenuItem: (item: MenuItem) => void;
  registerCollection: (collection: CollectionMetadata) => void;
}

const PluginContext = createContext<PluginContextValue | null>(null);

export const PluginsProvider = ({ children, apiUrl }: { children: ReactNode, apiUrl?: string }) => {
  const [slots, setSlots] = useState<Record<string, SlotComponent[]>>({});
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [collections, setCollections] = useState<CollectionMetadata[]>([]);
  const [translations, setTranslations] = useState<Record<string, any>>({});
  const [locale, setLocale] = useState<string>('en');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [pluginAPIs] = useState<Record<string, any>>({});
  const [events] = useState(() => new Map<string, Set<(data: any) => void>>());

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
    setMenuItems([]);
    setCollections([]);
  }, []);

  // Helper to load translations
  const loadTranslations = useCallback(async (newLocale: string) => {
    try {
      const bridgeUrl = typeof window !== 'undefined' ? (window as any).FROMCODE_API_URL : '';
      let effectiveApiUrl = apiUrl || bridgeUrl || 'http://api.framework.local';
      
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

  // Set up global bridge for dynamic plugins
  if (typeof window !== 'undefined' && !(window as any).Fromcode) {
    (window as any).React = React;
    (window as any).Fromcode = {
      React: React,
      registerSlotComponent: (name: string, comp: any) => {
        // Temporary holding until provider is ready
        if (!(window as any)._fromcodeQueue) (window as any)._fromcodeQueue = [];
        (window as any)._fromcodeQueue.push({ type: 'slot', name, comp });
      },
      t: (key: string) => key,
      locale: 'en'
    };
  }

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (apiUrl) (window as any).FROMCODE_API_URL = apiUrl;
      (window as any).React = React;
      
      const bridge = {
        React: React,
        registerSlotComponent,
        registerMenuItem,
        registerCollection,
        emit,
        on,
        registerAPI,
        getAPI,
        t,
        locale
      };

      (window as any).Fromcode = bridge;

      // Flush queue
      if ((window as any)._fromcodeQueue) {
        (window as any)._fromcodeQueue.forEach((item: any) => {
          if (item.type === 'slot') registerSlotComponent(item.name, item.comp);
        });
        delete (window as any)._fromcodeQueue;
      }
    }
  }, [apiUrl, registerSlotComponent, registerMenuItem, registerCollection, emit, on, registerAPI, getAPI, t, locale]);

  const value = React.useMemo(() => ({
    slots,
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
    registerMenuItem,
    registerCollection
  }), [slots, menuItems, collections, translations, locale, refreshVersion, triggerRefresh, t, emit, on, registerAPI, getAPI, registerSlotComponent, registerMenuItem, registerCollection]);

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
